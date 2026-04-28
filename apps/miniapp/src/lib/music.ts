// Фоновая lo-fi музыка через WebAudio. Без mp3-ассетов — генерим
// осцилляторами на лету. Стиль: classic ii-V-I-vi прогрессия в C major,
// 75 BPM, sine-pad с лёгким detune (chorus warmth), bass на каждом такте,
// мягкий hi-hat шейк, lowpass 1.6 kHz сверху всей шины (lo-fi feel).
//
// 4 такта × 4 beats × 0.8s = 12.8 сек loop, повторяется бесконечно через
// lookahead-scheduler. Громкость master 0.06 — заметно тише комфортного
// разговорного уровня, не перебивает sfx.
//
// Управляется единым sound toggle: setSoundEnabled() → start/stopMusic().

import { getSharedAudioContext } from './sounds'

const BPM = 75
const BEAT_S = 60 / BPM // 0.8 sec
const BAR_S = 4 * BEAT_S // 3.2 sec
const BARS = 4
const LOOP_S = BARS * BAR_S // 12.8 sec

interface ChordSpec {
  // Root note (для bass) и intervals в полутонах от root для аккорда (pad).
  root: { name: string; octave: number }
  intervals: number[]
}

function noteFreq(name: string, octave: number, semitoneShift = 0): number {
  const SEMI: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  }
  const semi = SEMI[name]
  if (semi === undefined) return 0
  // A4 = MIDI 69 = 440 Hz
  const midi = semi + (octave + 1) * 12 + semitoneShift
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ii-V-I-vi: Dm7 - G7 - Cmaj7 - Am7. Lo-fi классика, тёплая.
const PROGRESSION: ChordSpec[] = [
  // Dm7 = D F A C → root D + [0, 3, 7, 10]
  { root: { name: 'D', octave: 3 }, intervals: [0, 3, 7, 10] },
  // G7 = G B D F → root G + [0, 4, 7, 10]
  { root: { name: 'G', octave: 2 }, intervals: [0, 4, 7, 10] },
  // Cmaj7 = C E G B → root C + [0, 4, 7, 11]
  { root: { name: 'C', octave: 3 }, intervals: [0, 4, 7, 11] },
  // Am7 = A C E G → root A + [0, 3, 7, 10]
  { root: { name: 'A', octave: 2 }, intervals: [0, 3, 7, 10] },
]

interface PadVoice {
  freq: number
  gain: number
  detuneCents: number
}

function buildPadVoices(chord: ChordSpec): PadVoice[] {
  const voices: PadVoice[] = []
  // Pad — три верхних голоса аккорда в октаве 4-5, с лёгким detune для warmth.
  for (let i = 0; i < chord.intervals.length; i++) {
    const semi = chord.intervals[i]!
    // Поднимаем pad-voices на октаву от bass-root, чтобы не толкаться с басом.
    const freq = noteFreq(chord.root.name, chord.root.octave + 1, semi)
    voices.push({ freq, gain: 0.18, detuneCents: 0 })
    // Лёгкий "хорус": тот же тон, чуть-чуть detuned, тише — даёт widening.
    voices.push({ freq, gain: 0.09, detuneCents: 6 })
    voices.push({ freq, gain: 0.09, detuneCents: -6 })
  }
  return voices
}

// === State & nodes ===

let masterGain: GainNode | null = null
let lowpass: BiquadFilterNode | null = null
let isRunning = false
let nextLoopTime = 0
let scheduleTimer: number | null = null

const SCHEDULE_AHEAD_S = 0.6
const TICK_INTERVAL_MS = 250

function schedulePadChord(
  audio: AudioContext,
  destination: AudioNode,
  chord: ChordSpec,
  startAt: number,
  durationSec: number,
): void {
  const voices = buildPadVoices(chord)
  for (const v of voices) {
    const osc = audio.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = v.freq
    osc.detune.value = v.detuneCents

    const env = audio.createGain()
    // Slow attack/release — мягкий pad, без щелчков.
    env.gain.setValueAtTime(0, startAt)
    env.gain.linearRampToValueAtTime(v.gain, startAt + 0.25)
    env.gain.setValueAtTime(v.gain, startAt + durationSec - 0.4)
    env.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec)

    osc.connect(env).connect(destination)
    osc.start(startAt)
    osc.stop(startAt + durationSec + 0.05)
  }
}

function scheduleBass(
  audio: AudioContext,
  destination: AudioNode,
  chord: ChordSpec,
  startAt: number,
  durationSec: number,
): void {
  const osc = audio.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = noteFreq(chord.root.name, chord.root.octave - 1)

  const env = audio.createGain()
  env.gain.setValueAtTime(0, startAt)
  env.gain.linearRampToValueAtTime(0.5, startAt + 0.04)
  env.gain.setValueAtTime(0.5, startAt + 0.1)
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec)

  osc.connect(env).connect(destination)
  osc.start(startAt)
  osc.stop(startAt + durationSec + 0.05)
}

let noiseBuffer: AudioBuffer | null = null

function getNoiseBuffer(audio: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === audio.sampleRate) {
    return noiseBuffer
  }
  const len = audio.sampleRate * 0.15
  const buffer = audio.createBuffer(1, len, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1
  }
  noiseBuffer = buffer
  return buffer
}

function scheduleHat(
  audio: AudioContext,
  destination: AudioNode,
  startAt: number,
): void {
  const src = audio.createBufferSource()
  src.buffer = getNoiseBuffer(audio)

  // Bandpass высоко чтобы получить «ts» шейк.
  const bp = audio.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 7000
  bp.Q.value = 0.7

  const env = audio.createGain()
  env.gain.setValueAtTime(0, startAt)
  env.gain.linearRampToValueAtTime(0.18, startAt + 0.005)
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.06)

  src.connect(bp).connect(env).connect(destination)
  src.start(startAt)
  src.stop(startAt + 0.1)
}

function scheduleLoopFrom(audio: AudioContext, destination: AudioNode, t0: number): void {
  for (let bar = 0; bar < BARS; bar++) {
    const chord = PROGRESSION[bar]!
    const barStart = t0 + bar * BAR_S

    // Pad — целиком на bar
    schedulePadChord(audio, destination, chord, barStart, BAR_S - 0.05)
    // Bass — root note на 1 beat (короткий attack), потом тишина
    scheduleBass(audio, destination, chord, barStart, BEAT_S * 1.2)
    // Hi-hat: на 2 и 4 beats каждого bar (типичный backbeat акцент)
    scheduleHat(audio, destination, barStart + 1 * BEAT_S)
    scheduleHat(audio, destination, barStart + 3 * BEAT_S)
    // Light off-beats: 16-е на «и» 2 и 4
    scheduleHat(audio, destination, barStart + 1.5 * BEAT_S)
    scheduleHat(audio, destination, barStart + 3.5 * BEAT_S)
  }
}

function tick(): void {
  if (!isRunning) return
  const audio = getSharedAudioContext()
  if (!audio || !lowpass) return

  while (nextLoopTime < audio.currentTime + SCHEDULE_AHEAD_S) {
    scheduleLoopFrom(audio, lowpass, nextLoopTime)
    nextLoopTime += LOOP_S
  }

  scheduleTimer = window.setTimeout(tick, TICK_INTERVAL_MS)
}

export function startMusic(): void {
  if (isRunning) return
  const audio = getSharedAudioContext()
  if (!audio) return
  if (audio.state === 'suspended') {
    void audio.resume()
  }

  // Lowpass снимает яркие частоты — типичный lo-fi эффект «играет в комнате».
  lowpass = audio.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 1600
  lowpass.Q.value = 0.5

  masterGain = audio.createGain()
  masterGain.gain.value = 0.06

  lowpass.connect(masterGain)
  masterGain.connect(audio.destination)

  isRunning = true
  nextLoopTime = audio.currentTime + 0.05
  tick()
}

export function stopMusic(): void {
  if (!isRunning) return
  isRunning = false

  if (scheduleTimer != null) {
    clearTimeout(scheduleTimer)
    scheduleTimer = null
  }

  if (masterGain && lowpass) {
    const audio = getSharedAudioContext()
    const g = masterGain
    const lp = lowpass
    masterGain = null
    lowpass = null
    if (audio) {
      try {
        g.gain.setValueAtTime(g.gain.value, audio.currentTime)
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.2)
      } catch {
        // ignore
      }
    }
    setTimeout(() => {
      try {
        g.disconnect()
        lp.disconnect()
      } catch {
        // ignore
      }
    }, 300)
  }
}

export function isMusicPlaying(): boolean {
  return isRunning
}

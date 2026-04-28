// Фоновая chiptune-музыка через WebAudio. Никаких mp3-ассетов в бандле —
// генерим осцилляторами на лету. Saloon-style honky-tonk walking pattern
// в 8-bit chiptune исполнении: square-wave melody поверх triangle-wave bass.
//
// 4 такта в C major (I-I-IV-V), 100 BPM, 4/4. Loop ~9.6 сек, повторяется
// бесконечно через lookahead-scheduler (обычная техника WebAudio sequencer).
//
// Громкость держим тихо (master 0.025) чтобы не задушить sfx и чтобы юзеры
// не выключали через 5 секунд. Управляется единым sound toggle —
// startMusic/stopMusic вызываются из setSoundEnabled() в lib/sounds.ts.

import { getSharedAudioContext } from './sounds'

const BPM = 100
const BEAT_S = 60 / BPM // 0.6 sec
const EIGHTH_S = BEAT_S / 2 // 0.3 sec

interface NoteEvent {
  freq: number
  time: number // offset от начала loop'а, секунды
  duration: number
  type: OscillatorType
  gain: number
}

// MIDI note → frequency. C4 = 261.63 Hz.
function note(name: string, octave: number): number {
  const SEMITONES: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  }
  const semi = SEMITONES[name]
  if (semi === undefined) return 0
  // A4 (440 Hz) = MIDI 69. C4 = MIDI 60.
  const midi = semi + (octave + 1) * 12
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Bar-builder: каждый bar 4 beats × 0.6s = 2.4 sec.
// Bass: 4 четверти. Melody: 8 восьмых.
function buildBar(
  barIndex: number,
  bassNotes: ReadonlyArray<[string, number]>,
  melodyNotes: ReadonlyArray<[string, number]>,
): NoteEvent[] {
  const events: NoteEvent[] = []
  const barStart = barIndex * 4 * BEAT_S

  // Bass: 4 quarter-notes (triangle, тёплый low-end)
  for (let i = 0; i < 4; i++) {
    const [n, oct] = bassNotes[i % bassNotes.length]!
    events.push({
      freq: note(n, oct),
      time: barStart + i * BEAT_S,
      duration: BEAT_S * 0.85,
      type: 'triangle',
      gain: 0.5, // относительно masterGain
    })
  }

  // Melody: 8 eighth-notes (square, ярко-chiptune)
  for (let i = 0; i < 8; i++) {
    const [n, oct] = melodyNotes[i % melodyNotes.length]!
    events.push({
      freq: note(n, oct),
      time: barStart + i * EIGHTH_S,
      duration: EIGHTH_S * 0.7,
      type: 'square',
      gain: 0.25,
    })
  }

  return events
}

// 4 такта walking honky-tonk: I - I - IV - V → loop назад в I.
// Bar 1-2: Cmaj. Bar 3: Fmaj. Bar 4: Gmaj (доминанта, тянет в Cmaj первого).
function buildPattern(): { events: NoteEvent[]; duration: number } {
  const events: NoteEvent[] = []

  // Bar 1: Cmaj — bass C2/G2 ostinato, melody C-arpeggio
  events.push(
    ...buildBar(
      0,
      [
        ['C', 2],
        ['G', 2],
      ],
      [
        ['C', 5],
        ['E', 5],
        ['G', 5],
        ['E', 5],
      ],
    ),
  )

  // Bar 2: Cmaj — bass та же, melody поднимается выше
  events.push(
    ...buildBar(
      1,
      [
        ['C', 2],
        ['G', 2],
      ],
      [
        ['E', 5],
        ['G', 5],
        ['C', 6],
        ['G', 5],
      ],
    ),
  )

  // Bar 3: Fmaj (IV) — bass F2/C3, melody F-arpeggio
  events.push(
    ...buildBar(
      2,
      [
        ['F', 2],
        ['C', 3],
      ],
      [
        ['F', 5],
        ['A', 5],
        ['C', 6],
        ['A', 5],
      ],
    ),
  )

  // Bar 4: Gmaj (V) — bass G2/D3, melody G-arpeggio (resolves в C bar1)
  events.push(
    ...buildBar(
      3,
      [
        ['G', 2],
        ['D', 3],
      ],
      [
        ['G', 5],
        ['B', 5],
        ['D', 6],
        ['B', 5],
      ],
    ),
  )

  const duration = 4 * 4 * BEAT_S // 4 bars × 4 beats × 0.6s = 9.6s
  return { events, duration }
}

const PATTERN = buildPattern()

let masterGain: GainNode | null = null
let isRunning = false
let nextLoopTime = 0
let scheduleTimer: number | null = null

const SCHEDULE_AHEAD_S = 0.5
const TICK_INTERVAL_MS = 250

function scheduleNote(
  audio: AudioContext,
  master: GainNode,
  ev: NoteEvent,
  startAt: number,
): void {
  const osc = audio.createOscillator()
  const env = audio.createGain()
  osc.type = ev.type
  osc.frequency.value = ev.freq

  // ADSR-стиль envelope. Короткий attack (без щелчка), 50% sustain, decay в 0.
  env.gain.setValueAtTime(0, startAt)
  env.gain.linearRampToValueAtTime(ev.gain, startAt + 0.008)
  env.gain.linearRampToValueAtTime(ev.gain * 0.5, startAt + ev.duration * 0.4)
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + ev.duration)

  osc.connect(env).connect(master)
  osc.start(startAt)
  osc.stop(startAt + ev.duration + 0.05)
}

function tick(): void {
  if (!isRunning) return
  const audio = getSharedAudioContext()
  if (!audio || !masterGain) return

  // Lookahead scheduler: пока окно свободно — раскладываем следующую копию loop'а.
  while (nextLoopTime < audio.currentTime + SCHEDULE_AHEAD_S) {
    for (const ev of PATTERN.events) {
      scheduleNote(audio, masterGain, ev, nextLoopTime + ev.time)
    }
    nextLoopTime += PATTERN.duration
  }

  scheduleTimer = window.setTimeout(tick, TICK_INTERVAL_MS)
}

export function startMusic(): void {
  if (isRunning) return
  const audio = getSharedAudioContext()
  if (!audio) return
  // Resume на случай если контекст suspended (autoplay policy после mount).
  // Если резюм не пройдёт — нота упадёт в гордой тишине, не критично.
  if (audio.state === 'suspended') {
    void audio.resume()
  }

  masterGain = audio.createGain()
  // Тихо: BGM не должна перебивать sfx и не должна раздражать.
  masterGain.gain.value = 0.025
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

  if (masterGain) {
    const audio = getSharedAudioContext()
    const g = masterGain
    masterGain = null
    if (audio) {
      try {
        g.gain.setValueAtTime(g.gain.value, audio.currentTime)
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.15)
      } catch {
        // ignore
      }
    }
    setTimeout(() => {
      try {
        g.disconnect()
      } catch {
        // ignore
      }
    }, 250)
  }
}

export function isMusicPlaying(): boolean {
  return isRunning
}

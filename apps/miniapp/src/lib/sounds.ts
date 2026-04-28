// Звуковые эффекты через WebAudio API. Генерируем короткие тоны на лету
// (oscillator + envelope) — никаких mp3 в бандле. Ленивая инициализация
// AudioContext на первом playSfx, чтобы попасть в user-gesture окно
// браузера и не получить отказ от autoplay policy.
//
// Состояние on/off держим в localStorage `wr.soundEnabled` (default: on).
// Любой системный сбой (нет AudioContext, отказ resume, ошибка осциллятора)
// проглатывается — звук это nice-to-have, не должен ломать игру.
//
// Sound toggle также управляет фоновой chiptune-музыкой из lib/music.ts.

import { startMusic, stopMusic, isMusicPlaying } from './music'

type SfxKind = 'tap' | 'success' | 'fail' | 'tick'

const STORAGE_KEY = 'wr.soundEnabled'

let ctx: AudioContext | null = null
let cachedEnabled: boolean | null = null

function readEnabledFromStorage(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === '0' || v === 'false') return false
  } catch {
    // localStorage недоступен — оставляем включённым.
  }
  return true
}

export function isSoundEnabled(): boolean {
  if (cachedEnabled === null) cachedEnabled = readEnabledFromStorage()
  return cachedEnabled
}

export function setSoundEnabled(enabled: boolean): void {
  cachedEnabled = enabled
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // не критично — переживёт ремаунт через cached state.
  }
  // Toggle на UI — это user-gesture, тут можно запускать BGM сразу.
  // При выключении — гасим, при включении — стартуем (если ещё не).
  if (enabled) {
    startMusic()
  } else {
    stopMusic()
  }
}

interface AudioContextCtor {
  new (): AudioContext
}
interface WindowWithAudio {
  AudioContext?: AudioContextCtor
  webkitAudioContext?: AudioContextCtor
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const w = window as unknown as WindowWithAudio
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

// Шаринг AudioContext с lib/music.ts. Один контекст на всё приложение —
// экономит ресурсы и обходит политику autoplay через одно user-gesture.
export function getSharedAudioContext(): AudioContext | null {
  return getCtx()
}

interface ToneSpec {
  frequency: number
  durationMs: number
  type: OscillatorType
  // Пиковая громкость envelope. Держим тихо (≤ 0.1), потому что Telegram-клиент
  // на телефоне любит играть громче, чем браузер на десктопе.
  gain: number
  // Опциональный второй тон через X миллисекунд после первого — для success.
  follow?: { frequency: number; delayMs: number }
}

const SPECS: Record<SfxKind, ToneSpec> = {
  tap: { frequency: 700, durationMs: 40, type: 'sine', gain: 0.04 },
  success: {
    frequency: 660,
    durationMs: 90,
    type: 'sine',
    gain: 0.08,
    follow: { frequency: 990, delayMs: 60 },
  },
  fail: { frequency: 180, durationMs: 130, type: 'sawtooth', gain: 0.05 },
  tick: { frequency: 1100, durationMs: 25, type: 'square', gain: 0.03 },
}

function playTone(audio: AudioContext, spec: ToneSpec, when: number): void {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = spec.type
  osc.frequency.value = spec.frequency

  const attack = 0.005
  const release = spec.durationMs / 1000
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(spec.gain, when + attack)
  // Плавное затухание до нуля — без щелчка на отрезании.
  gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + release)

  osc.connect(gain).connect(audio.destination)
  osc.start(when)
  osc.stop(when + attack + release + 0.02)
}

export function playSfx(kind: SfxKind): void {
  if (!isSoundEnabled()) return
  const audio = getCtx()
  if (!audio) return
  try {
    if (audio.state === 'suspended') {
      // Asynchronous; ignore promise — следующий вызов попадёт в running.
      void audio.resume()
    }
    const spec = SPECS[kind]
    const now = audio.currentTime
    playTone(audio, spec, now)
    if (spec.follow) {
      playTone(
        audio,
        { ...spec, frequency: spec.follow.frequency, follow: undefined },
        now + spec.follow.delayMs / 1000,
      )
    }
    // Первый sfx = первое user-gesture, в это окно можно поднять BGM
    // (если она не играет и звук включён). Toggle уже сам стартует music
    // напрямую — этот путь покрывает юзеров, которые не трогали toggle.
    if (!isMusicPlaying()) startMusic()
  } catch {
    // ignore
  }
}

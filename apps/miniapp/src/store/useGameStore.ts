// Глобальный стейт игры — навигация, текущая партия, выбор букв, результат,
// статус серверной отправки сессии.

import { create } from 'zustand'
import {
  calculateScore,
  getDailyLetters,
  getTodaySeed,
  MIN_WORD_LENGTH,
  type DailySeed,
  type Letters,
} from '@word-royale/shared'
import { fetchTodayStatus, recordAdReward, submitSession } from '../lib/api'
import { showRewardedAd } from '../lib/monetag'

export type Screen = 'home' | 'game' | 'result' | 'leaderboard' | 'shop'
export type Feedback = null | 'success' | 'invalid' | 'duplicate' | 'too-short'
export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

// 'default' — встроенная тема, бесплатна для всех. Остальные нужно купить.
export const ALL_THEMES = ['default', 'neon', 'retro', 'sakura', 'cyberpunk'] as const
export type ThemeId = (typeof ALL_THEMES)[number]

export type TodayStatusState =
  | { loaded: false }
  | {
      loaded: true
      playedToday: boolean
      replayCredits: number
      themes: string[]
      doubleScoreActive: boolean
      proActive: boolean
      proExpiresAt: string | null
      adsWatchedToday: number
      adsMaxPerDay: number
    }

export const REWARDED_AD_BONUS_SECONDS = 30

const SELECTED_THEME_KEY = 'wr.selectedTheme'

function readSelectedThemeFromStorage(): ThemeId {
  try {
    const v = localStorage.getItem(SELECTED_THEME_KEY)
    if (v && (ALL_THEMES as readonly string[]).includes(v)) {
      return v as ThemeId
    }
  } catch {
    // localStorage может быть недоступен — fallback на default.
  }
  return 'default'
}

function applyThemeToDom(theme: ThemeId): void {
  if (typeof document === 'undefined') return
  // 'default' — атрибут снимаем, чтобы CSS-переменные взялись из :root.
  if (theme === 'default') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export const GAME_DURATION_SECONDS = 90

interface GameState {
  screen: Screen

  // текущая партия
  seed: DailySeed
  letters: Letters
  selectedIndices: number[]
  foundWords: string[]
  score: number
  feedback: Feedback
  timeLeft: number

  // серверная отправка результата
  submitStatus: SubmitStatus
  submitError: string | null
  serverScore: number | null
  // boost ×2 потрачен на этой сессии — UI покажет «×2 applied» рядом со счётом
  doubleScoreApplied: boolean

  // статус юзера на сегодня — играл ли уже и сколько replay-токенов
  todayStatus: TodayStatusState

  // выбранная тема. Применяется к <html data-theme> через applyThemeToDom().
  // Persist в localStorage, чтобы пережить ремаунт Mini App.
  selectedTheme: ThemeId

  goHome: () => void
  showLeaderboard: () => void
  showShop: () => void
  startGame: () => void
  setSelectedTheme: (theme: ThemeId) => void
  // Запускает Monetag rewarded-ad и +30s к таймеру при success.
  watchRewardedAd: (initData: string) => Promise<{ ok: boolean; reason?: string }>
  toggleLetter: (index: number) => void
  clearSelection: () => void
  submitWord: (dict: Set<string>) => void
  clearFeedback: () => void
  tickTimer: () => void
  submitCurrentSession: (initData: string) => Promise<void>
  refreshTodayStatus: (initData: string) => Promise<void>
}

const todaySeed = getTodaySeed()
const initialTheme = readSelectedThemeFromStorage()
applyThemeToDom(initialTheme)

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'home',
  seed: todaySeed,
  letters: getDailyLetters(todaySeed),
  selectedIndices: [],
  foundWords: [],
  score: 0,
  feedback: null,
  timeLeft: GAME_DURATION_SECONDS,

  submitStatus: 'idle',
  submitError: null,
  serverScore: null,
  doubleScoreApplied: false,

  todayStatus: { loaded: false },

  selectedTheme: initialTheme,

  goHome: () => set({ screen: 'home' }),

  showLeaderboard: () => set({ screen: 'leaderboard' }),

  showShop: () => set({ screen: 'shop' }),

  setSelectedTheme: (theme) => {
    applyThemeToDom(theme)
    try {
      localStorage.setItem(SELECTED_THEME_KEY, theme)
    } catch {
      // не критично — следующая сессия откатится на default.
    }
    set({ selectedTheme: theme })
  },

  startGame: () => {
    const seed = getTodaySeed()
    set({
      screen: 'game',
      seed,
      letters: getDailyLetters(seed),
      selectedIndices: [],
      foundWords: [],
      score: 0,
      feedback: null,
      timeLeft: GAME_DURATION_SECONDS,
      submitStatus: 'idle',
      submitError: null,
      serverScore: null,
      doubleScoreApplied: false,
    })
  },

  toggleLetter: (index) => {
    const { selectedIndices, letters } = get()
    if (index < 0 || index >= letters.length) return
    const at = selectedIndices.indexOf(index)
    if (at === -1) {
      set({ selectedIndices: [...selectedIndices, index], feedback: null })
    } else {
      // Тап по уже выбранной букве убирает её и все, что после — стандартный UX
      set({ selectedIndices: selectedIndices.slice(0, at), feedback: null })
    }
  },

  clearSelection: () => set({ selectedIndices: [], feedback: null }),

  submitWord: (dict) => {
    const { selectedIndices, letters, foundWords, score } = get()
    const word = selectedIndices.map((i) => letters[i]).join('')

    if (word.length < MIN_WORD_LENGTH) {
      set({ feedback: 'too-short', selectedIndices: [] })
      return
    }
    if (foundWords.includes(word)) {
      set({ feedback: 'duplicate', selectedIndices: [] })
      return
    }
    if (!dict.has(word)) {
      set({ feedback: 'invalid', selectedIndices: [] })
      return
    }
    set({
      foundWords: [...foundWords, word],
      score: score + calculateScore(word),
      selectedIndices: [],
      feedback: 'success',
    })
  },

  clearFeedback: () => set({ feedback: null }),

  tickTimer: () => {
    const { timeLeft, screen } = get()
    if (screen !== 'game' || timeLeft <= 0) return
    const next = timeLeft - 1
    if (next <= 0) {
      set({ timeLeft: 0, screen: 'result', selectedIndices: [], feedback: null })
    } else {
      set({ timeLeft: next })
    }
  },

  submitCurrentSession: async (initData) => {
    const { seed, letters, foundWords, score, submitStatus } = get()
    if (submitStatus === 'submitting' || submitStatus === 'success') return
    set({ submitStatus: 'submitting', submitError: null })
    const result = await submitSession({
      initData,
      dailySeed: seed,
      letters: [...letters],
      wordsFound: foundWords,
      score,
      durationSec: GAME_DURATION_SECONDS,
    })
    // Сохраняем уже известный набор тем — submit-score его не возвращает,
    // а перезатирать пустым массивом нельзя, иначе ShopScreen «забудет» owned.
    const prevStatus = get().todayStatus
    const prevThemes = prevStatus.loaded ? prevStatus.themes : []
    const prevPro = prevStatus.loaded ? prevStatus.proActive : false
    const prevProExpires = prevStatus.loaded ? prevStatus.proExpiresAt : null
    const prevAdsCount = prevStatus.loaded ? prevStatus.adsWatchedToday : 0
    const prevAdsMax = prevStatus.loaded ? prevStatus.adsMaxPerDay : 0
    if (result.ok) {
      set({
        submitStatus: 'success',
        serverScore: result.score,
        doubleScoreApplied: result.doubleScoreUsed,
        submitError: null,
        // На сегодня юзер уже точно играл; кредиты могли уменьшиться
        // (если это была replay-сессия). Если буст потратился — флаг тушим.
        // Pro-статус submit-score не возвращает — сохраняем предыдущий.
        todayStatus: {
          loaded: true,
          playedToday: true,
          replayCredits: result.replayCreditsLeft,
          themes: prevThemes,
          doubleScoreActive: false,
          proActive: prevPro,
          proExpiresAt: prevProExpires,
          adsWatchedToday: prevAdsCount,
          adsMaxPerDay: prevAdsMax,
        },
      })
    } else {
      // При no_replay сервер уже знает, что юзер играл сегодня и кредитов нет —
      // обновляем todayStatus, чтобы Home корректно показал «Buy replay» и не
      // светил кнопкой Play, ведущей в тот же тупик. Boost не трогаем — сессия
      // не записалась, double_score_date в БД остался.
      if (result.error === 'no_replay') {
        const prevDouble = prevStatus.loaded ? prevStatus.doubleScoreActive : false
        set({
          submitStatus: 'error',
          submitError: result.error,
          todayStatus: {
            loaded: true,
            playedToday: true,
            replayCredits: 0,
            themes: prevThemes,
            doubleScoreActive: prevDouble,
            proActive: prevPro,
            proExpiresAt: prevProExpires,
            adsWatchedToday: prevAdsCount,
            adsMaxPerDay: prevAdsMax,
          },
        })
      } else {
        set({ submitStatus: 'error', submitError: result.error })
      }
    }
  },

  refreshTodayStatus: async (initData) => {
    const { seed } = get()
    const result = await fetchTodayStatus(initData, seed)
    if (!result.ok) {
      // Молчаливо: статус — это UX-подсказка, ошибка не должна ломать экран.
      // В худшем случае юзер попробует Play и получит no_replay из submit-score.
      console.warn('today-status failed', result.error)
      return
    }
    set({
      todayStatus: {
        loaded: true,
        playedToday: result.playedToday,
        replayCredits: result.replayCredits,
        themes: result.themes,
        doubleScoreActive: result.doubleScoreActive,
        proActive: result.proActive,
        proExpiresAt: result.proExpiresAt,
        adsWatchedToday: result.adsWatchedToday,
        adsMaxPerDay: result.adsMaxPerDay,
      },
    })
  },

  watchRewardedAd: async (initData) => {
    const status = get().todayStatus
    if (status.loaded && status.adsWatchedToday >= status.adsMaxPerDay) {
      return { ok: false, reason: 'limit' }
    }
    const shown = await showRewardedAd()
    if (!shown) return { ok: false, reason: 'ad_unavailable' }

    // SDK подтвердил показ — фиксируем в БД и проверяем дневной лимит.
    const recorded = await recordAdReward(initData)
    if (!recorded.ok) return { ok: false, reason: recorded.error }
    if (!recorded.allowed) return { ok: false, reason: 'limit' }

    // Бонус: +30 сек к таймеру + обновляем счётчик в локальном состоянии.
    const { timeLeft, screen } = get()
    if (screen === 'game' && timeLeft > 0) {
      set({ timeLeft: timeLeft + REWARDED_AD_BONUS_SECONDS })
    }
    if (status.loaded) {
      set({
        todayStatus: {
          ...status,
          adsWatchedToday: recorded.watchedToday,
          adsMaxPerDay: recorded.maxPerDay,
        },
      })
    }
    return { ok: true }
  },
}))

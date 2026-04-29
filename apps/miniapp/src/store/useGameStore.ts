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
import {
  fetchTodayStatus,
  recordAdReward,
  submitSession,
  type StreakRewardType,
} from '../lib/api'
import { showRewardedAd } from '../lib/monetag'
import { track } from '../lib/analytics'
import { captureMessage } from '../lib/sentry'
import { hapticImpact, hapticNotify, hapticSelection } from '../lib/haptics'
import { playSfx } from '../lib/sounds'

export type Screen = 'home' | 'game' | 'result' | 'leaderboard' | 'shop' | 'me'
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
      currentStreak: number
      bestStreak: number
      proTrialActive: boolean
      proTrialUsed: boolean
      weekStart: string
      weekEnd: string
      weeklyRank: number | null
      weeklyTotalScore: number | null
    }


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

// product_id → room name из handoff'а Claude Design Phase D.
// БД и Stars-инвойсы продолжают видеть старые product_id (theme_neon
// / theme_retro / etc.), а data-theme на <html> ставим room name —
// чтобы [data-theme="arcade"] блок в design-tokens.css сработал.
const THEME_ROOM: Record<ThemeId, string | null> = {
  default: null, // saloon — :root values, attribute снимаем
  neon: 'arcade',
  retro: 'diner',
  sakura: 'kyoto',
  cyberpunk: 'neoTokyo',
}

function applyThemeToDom(theme: ThemeId): void {
  if (typeof document === 'undefined') return
  const room = THEME_ROOM[theme]
  if (room === null) {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', room)
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
  // Достигнутый порог streak (3/7/30) после insert — 0 если не пересечён
  streakMilestoneReached: number
  // Тип выданной награды (replay_credit/theme_neon/pro_30d) или null если RPC
  // не выдала (race с другой сессией) — UI показывает соответствующий toast.
  streakReward: StreakRewardType | null
  // True, если submit-score только что выдал Pro free trial (после 3-й партии).
  // ResultScreen рендерит trial-unlocked Card. Сбрасывается при startGame.
  proTrialGranted: boolean

  // статус юзера на сегодня — играл ли уже и сколько replay-токенов
  todayStatus: TodayStatusState

  // выбранная тема. Применяется к <html data-theme> через applyThemeToDom().
  // Persist в localStorage, чтобы пережить ремаунт Mini App.
  selectedTheme: ThemeId

  goHome: () => void
  showLeaderboard: () => void
  showShop: () => void
  showMe: () => void
  // Если UTC-день сменился — обновляет seed/letters в store и сбрасывает
  // todayStatus, чтобы UI запросил статус для нового дня. Возвращает true,
  // если сменилось. Клиенты должны звать refreshTodayStatus() после true.
  rolloverDayIfNeeded: () => boolean
  startGame: () => void
  setSelectedTheme: (theme: ThemeId) => void
  // Запускает Monetag rewarded-ad → +1 replay_credit при success.
  // Используется на ResultScreen как бесплатная альтернатива Buy replay.
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
  streakMilestoneReached: 0,
  streakReward: null,
  proTrialGranted: false,

  todayStatus: { loaded: false },

  selectedTheme: initialTheme,

  goHome: () => set({ screen: 'home' }),

  showLeaderboard: () => set({ screen: 'leaderboard' }),

  showShop: () => set({ screen: 'shop' }),

  showMe: () => set({ screen: 'me' }),

  rolloverDayIfNeeded: () => {
    const newSeed = getTodaySeed()
    const currentSeed = get().seed
    if (newSeed === currentSeed) return false
    set({
      seed: newSeed,
      letters: getDailyLetters(newSeed),
      todayStatus: { loaded: false },
    })
    return true
  },

  setSelectedTheme: (theme) => {
    applyThemeToDom(theme)
    try {
      localStorage.setItem(SELECTED_THEME_KEY, theme)
    } catch {
      // не критично — следующая сессия откатится на default.
    }
    track('theme_applied', { theme_id: theme })
    set({ selectedTheme: theme })
  },

  startGame: () => {
    const seed = getTodaySeed()
    const status = get().todayStatus
    track('game_started', {
      seed,
      is_replay: status.loaded ? status.playedToday : false,
      replay_credits_before:
        status.loaded ? status.replayCredits : null,
      double_score_active:
        status.loaded ? status.doubleScoreActive : false,
      pro_active: status.loaded ? status.proActive : false,
    })
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
      streakMilestoneReached: 0,
      streakReward: null,
      proTrialGranted: false,
    })
  },

  toggleLetter: (index) => {
    const { selectedIndices, letters } = get()
    if (index < 0 || index >= letters.length) return
    hapticSelection()
    playSfx('tap')
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
      hapticNotify('warning')
      playSfx('fail')
      set({ feedback: 'too-short', selectedIndices: [] })
      return
    }
    if (foundWords.includes(word)) {
      hapticNotify('warning')
      playSfx('fail')
      set({ feedback: 'duplicate', selectedIndices: [] })
      return
    }
    if (!dict.has(word)) {
      hapticNotify('error')
      playSfx('fail')
      set({ feedback: 'invalid', selectedIndices: [] })
      return
    }
    const wordScore = calculateScore(word)
    hapticNotify('success')
    playSfx('success')
    track('word_found', { word_length: word.length, word_score: wordScore })
    set({
      foundWords: [...foundWords, word],
      score: score + wordScore,
      selectedIndices: [],
      feedback: 'success',
    })
  },

  clearFeedback: () => set({ feedback: null }),

  tickTimer: () => {
    const { timeLeft, screen, score, foundWords, seed } = get()
    if (screen !== 'game' || timeLeft <= 0) return
    const next = timeLeft - 1
    if (next <= 0) {
      const longest = foundWords.reduce(
        (a, b) => (b.length > a.length ? b : a),
        '',
      )
      hapticImpact('heavy')
      track('game_completed', {
        seed,
        score,
        words_count: foundWords.length,
        longest_length: longest.length,
      })
      set({ timeLeft: 0, screen: 'result', selectedIndices: [], feedback: null })
    } else {
      // Тиканье на последних 10 секундах — лёгкий звуковой счётчик
      // (haptic тут не зовём, чтобы не вибрировать каждую секунду).
      if (next <= 10) playSfx('tick')
      set({ timeLeft: next })
    }
  },

  submitCurrentSession: async (initData) => {
    const { seed, letters, foundWords, score, submitStatus } = get()
    if (submitStatus === 'submitting' || submitStatus === 'success') return
    set({ submitStatus: 'submitting', submitError: null })
    // Telegram WebApp работает в обычном браузере, поэтому Date знает
    // системный tz. Перегоняем в «минуты от UTC, положительный для Восточных».
    // Москва UTC+3 → JS getTimezoneOffset() = -180 → tzOffsetMin = +180.
    const tzOffsetMin =
      typeof Date !== 'undefined'
        ? -new Date().getTimezoneOffset()
        : undefined
    const result = await submitSession({
      initData,
      dailySeed: seed,
      letters: [...letters],
      wordsFound: foundWords,
      score,
      durationSec: GAME_DURATION_SECONDS,
      tzOffsetMin,
    })
    // Сохраняем уже известный набор тем — submit-score его не возвращает,
    // а перезатирать пустым массивом нельзя, иначе ShopScreen «забудет» owned.
    const prevStatus = get().todayStatus
    const prevThemes = prevStatus.loaded ? prevStatus.themes : []
    const prevPro = prevStatus.loaded ? prevStatus.proActive : false
    const prevProExpires = prevStatus.loaded ? prevStatus.proExpiresAt : null
    const prevAdsCount = prevStatus.loaded ? prevStatus.adsWatchedToday : 0
    const prevAdsMax = prevStatus.loaded ? prevStatus.adsMaxPerDay : 0
    const prevBestStreak = prevStatus.loaded ? prevStatus.bestStreak : 0
    const prevTrialActive = prevStatus.loaded ? prevStatus.proTrialActive : false
    const prevTrialUsed = prevStatus.loaded ? prevStatus.proTrialUsed : false
    const prevWeekStart = prevStatus.loaded ? prevStatus.weekStart : ''
    const prevWeekEnd = prevStatus.loaded ? prevStatus.weekEnd : ''
    const prevWeeklyRank = prevStatus.loaded ? prevStatus.weeklyRank : null
    const prevWeeklyTotal = prevStatus.loaded ? prevStatus.weeklyTotalScore : null
    if (result.ok) {
      // Streak-награда + Pro free trial меняют owned themes / proActive — патчим
      // оптимистично, чтобы UI на ResultScreen и MeScreen увидел изменения
      // сразу. Полное обновление придёт через refreshTodayStatus.
      const themesAfter =
        result.streakReward === 'theme_neon' && !prevThemes.includes('neon')
          ? [...prevThemes, 'neon']
          : prevThemes
      // Pro может включиться двумя путями за одну сессию — streak 30d и/или
      // trial. Trial короче (24h), streak 30d длиннее — берём дальнюю дату.
      const proRewardActive =
        result.streakReward === 'pro_30d' || result.proTrialGranted
      const proAfter = proRewardActive ? true : prevPro
      const candidateExpires: number[] = []
      if (prevProExpires) candidateExpires.push(new Date(prevProExpires).getTime())
      if (result.streakReward === 'pro_30d') {
        candidateExpires.push(
          Math.max(
            prevProExpires ? new Date(prevProExpires).getTime() : 0,
            Date.now(),
          ) + 30 * 24 * 60 * 60 * 1000,
        )
      }
      if (result.proTrialGranted && result.proTrialExpiresAt) {
        candidateExpires.push(new Date(result.proTrialExpiresAt).getTime())
      }
      const proExpiresAfter =
        candidateExpires.length === 0
          ? prevProExpires
          : new Date(Math.max(...candidateExpires)).toISOString()
      const newCurrentStreak = result.currentStreak
      const newBestStreak = Math.max(prevBestStreak, newCurrentStreak)
      const trialActiveAfter = result.proTrialGranted ? true : prevTrialActive
      const trialUsedAfter = result.proTrialGranted ? true : prevTrialUsed
      if (result.streakMilestoneReached > 0) {
        track('streak_milestone_reached', {
          milestone: result.streakMilestoneReached,
          reward_type: result.streakReward ?? 'none',
          current_streak: newCurrentStreak,
        })
      }
      if (result.proTrialGranted) {
        track('pro_trial_granted', {
          expires_at: result.proTrialExpiresAt,
        })
      }
      set({
        submitStatus: 'success',
        serverScore: result.score,
        doubleScoreApplied: result.doubleScoreUsed,
        submitError: null,
        streakMilestoneReached: result.streakMilestoneReached,
        streakReward: result.streakReward,
        proTrialGranted: result.proTrialGranted,
        // На сегодня юзер уже точно играл; кредиты могли уменьшиться
        // (если это была replay-сессия). Если буст потратился — флаг тушим.
        // Pro-статус submit-score не возвращает — сохраняем предыдущий.
        todayStatus: {
          loaded: true,
          playedToday: true,
          replayCredits: result.replayCreditsLeft,
          themes: themesAfter,
          doubleScoreActive: false,
          proActive: proAfter,
          proExpiresAt: proExpiresAfter,
          adsWatchedToday: prevAdsCount,
          adsMaxPerDay: prevAdsMax,
          currentStreak: newCurrentStreak,
          bestStreak: newBestStreak,
          proTrialActive: trialActiveAfter,
          proTrialUsed: trialUsedAfter,
          weekStart: prevWeekStart,
          weekEnd: prevWeekEnd,
          // Weekly rank после новой партии может улучшиться. Точное значение
          // пересчитает refreshTodayStatus — здесь сохраняем prev, чтобы UI
          // не мигал «—» между submit и refresh.
          weeklyRank: prevWeeklyRank,
          weeklyTotalScore: prevWeeklyTotal,
        },
      })
    } else {
      // При no_replay сервер уже знает, что юзер играл сегодня и кредитов нет —
      // обновляем todayStatus, чтобы Home корректно показал «Buy replay» и не
      // светил кнопкой Play, ведущей в тот же тупик. Boost не трогаем — сессия
      // не записалась, double_score_date в БД остался.
      if (result.error === 'no_replay') {
        const prevDouble = prevStatus.loaded ? prevStatus.doubleScoreActive : false
        const prevStreak = prevStatus.loaded ? prevStatus.currentStreak : 0
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
            currentStreak: prevStreak,
            bestStreak: prevBestStreak,
            proTrialActive: prevTrialActive,
            proTrialUsed: prevTrialUsed,
            weekStart: prevWeekStart,
            weekEnd: prevWeekEnd,
            weeklyRank: prevWeeklyRank,
            weeklyTotalScore: prevWeeklyTotal,
          },
        })
      } else {
        // network/env_missing — ожидаемые для мобильного, остальное — настоящая
        // серверная аномалия (seed_mismatch, score_mismatch, words_not_in_dictionary,
        // bad_response): шлём в Sentry, чтобы понимать частоту.
        if (result.error !== 'network' && result.error !== 'env_missing') {
          captureMessage('submit-score failed', {
            error: result.error,
            status: (result as { status?: number }).status ?? null,
          })
        }
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
      if (!result.error.startsWith('network')) {
        captureMessage('today-status failed', { error: result.error })
      }
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
        currentStreak: result.currentStreak,
        bestStreak: result.bestStreak,
        proTrialActive: result.proTrialActive,
        proTrialUsed: result.proTrialUsed,
        weekStart: result.weekStart,
        weekEnd: result.weekEnd,
        weeklyRank: result.weeklyRank,
        weeklyTotalScore: result.weeklyTotalScore,
      },
    })
  },

  watchRewardedAd: async (initData) => {
    const status = get().todayStatus
    if (status.loaded && status.adsWatchedToday >= status.adsMaxPerDay) {
      track('ad_watched', { result: 'limit' })
      return { ok: false, reason: 'limit' }
    }
    const shown = await showRewardedAd()
    if (!shown) {
      track('ad_watched', { result: 'unavailable' })
      return { ok: false, reason: 'ad_unavailable' }
    }

    // SDK подтвердил показ — фиксируем в БД (RPC атомарно инкрементит счётчик
    // ads и replay_credits, либо отказывает по лимиту).
    const recorded = await recordAdReward(initData)
    if (!recorded.ok) {
      track('ad_watched', { result: 'record_failed', error: recorded.error })
      return { ok: false, reason: recorded.error }
    }
    if (!recorded.allowed) {
      track('ad_watched', { result: 'limit' })
      return { ok: false, reason: 'limit' }
    }

    track('ad_watched', {
      result: 'success',
      watched_today: recorded.watchedToday,
      replay_credits_after: recorded.replayCredits,
    })

    // +1 replay_credit получен. Обновляем todayStatus, чтобы UI ResultScreen
    // тут же переключился с «Buy replay» на «Play replay (N)».
    if (status.loaded) {
      set({
        todayStatus: {
          ...status,
          replayCredits: recorded.replayCredits,
          adsWatchedToday: recorded.watchedToday,
          adsMaxPerDay: recorded.maxPerDay,
        },
      })
    }
    return { ok: true }
  },
}))

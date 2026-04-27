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
import { submitSession } from '../lib/api'

export type Screen = 'home' | 'game' | 'result' | 'leaderboard'
export type Feedback = null | 'success' | 'invalid' | 'duplicate' | 'too-short'
export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

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

  goHome: () => void
  showLeaderboard: () => void
  startGame: () => void
  toggleLetter: (index: number) => void
  clearSelection: () => void
  submitWord: (dict: Set<string>) => void
  clearFeedback: () => void
  tickTimer: () => void
  submitCurrentSession: (initData: string) => Promise<void>
}

const todaySeed = getTodaySeed()

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

  goHome: () => set({ screen: 'home' }),

  showLeaderboard: () => set({ screen: 'leaderboard' }),

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
    if (result.ok) {
      set({ submitStatus: 'success', serverScore: result.score, submitError: null })
    } else {
      set({ submitStatus: 'error', submitError: result.error })
    }
  },
}))

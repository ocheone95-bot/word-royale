// Глобальный стейт игры. Сейчас содержит только навигацию между экранами,
// на следующих шагах добавятся выбранные буквы, найденные слова, скор и таймер.

import { create } from 'zustand'

export type Screen = 'home' | 'game' | 'result'

interface GameState {
  screen: Screen
  setScreen: (screen: Screen) => void
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'home',
  setScreen: (screen) => set({ screen }),
}))

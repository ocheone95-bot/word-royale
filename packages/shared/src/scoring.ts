// Подсчёт очков за слово. Чистая функция — одинаково работает на клиенте и сервере.

const SCORES_BY_LENGTH: Readonly<Record<number, number>> = {
  3: 100,
  4: 400,
  5: 1200,
  6: 2000,
  7: 4000,
};

export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 7;

export function calculateScore(word: string): number {
  const len = word.length;
  if (len < MIN_WORD_LENGTH || len > MAX_WORD_LENGTH) return 0;
  return SCORES_BY_LENGTH[len] ?? 0;
}

export function calculateTotalScore(words: readonly string[]): number {
  return words.reduce((sum, w) => sum + calculateScore(w), 0);
}

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

// Можно ли составить слово из набора букв.
// Каждая буква в наборе используется не более чем встречается (сейчас всегда 1).
export function isComposableFrom(
  word: string,
  letters: readonly string[],
): boolean {
  const available = new Map<string, number>();
  for (const l of letters) {
    available.set(l, (available.get(l) ?? 0) + 1);
  }
  for (const ch of word) {
    const left = available.get(ch);
    if (!left) return false;
    available.set(ch, left - 1);
  }
  return true;
}

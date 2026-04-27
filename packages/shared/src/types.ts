// Общие типы Word Royale — используются на фронте и в будущих Edge Functions.

// 'YYYY-MM-DD' в UTC. У всех игроков мира одинаковый seed на одну дату.
export type DailySeed = string;

// 7 букв в нижнем регистре. Могут повторяться.
export type Letters = readonly string[];

export interface GameSession {
  seed: DailySeed;
  letters: Letters;
  score: number;
  wordsFound: string[];
  durationSec: number;
  finishedAt: string; // ISO timestamp
}

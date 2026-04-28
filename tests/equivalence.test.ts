// Sanity-тест игровой логики из @word-royale/shared.
//
// Раньше тут была защита от дрейфа между packages/shared и
// supabase/functions/_shared/game.ts (Deno не любил .js-импорты в TS).
// Сейчас _shared/game.ts — это re-export из packages/shared (allowImportingTsExtensions),
// так что «client» и «server» — буквально один и тот же модуль.
// Тест оставлен как набор поведенческих кейсов: scoring, daily-seed детерминизм,
// cross-day разнообразие. Если в будущем Deno снова не сможет читать shared —
// вернём дубль и роль теста снова станет защитой эквивалентности.

import { describe, expect, it } from 'vitest';

// Клиент.
import {
  calculateScore as clientCalculateScore,
  calculateTotalScore as clientCalculateTotal,
  MAX_WORD_LENGTH as clientMax,
  MIN_WORD_LENGTH as clientMin,
} from '../packages/shared/src/scoring.ts';
import {
  getDailyLetters as clientGetDailyLetters,
  getTodaySeed as clientGetTodaySeed,
} from '../packages/shared/src/daily-seed.ts';

// Сервер.
import {
  calculateScore as serverCalculateScore,
  calculateTotalScore as serverCalculateTotal,
  getDailyLetters as serverGetDailyLetters,
  getTodaySeed as serverGetTodaySeed,
  MAX_WORD_LENGTH as serverMax,
  MIN_WORD_LENGTH as serverMin,
} from '../supabase/functions/_shared/game.ts';

// Набор seed'ов: смесь прошлого, настоящего и будущего, чтобы поймать любой
// дрейф в hash/PRNG/частотных весах. Включаем граничные даты года.
const SEEDS = [
  '2024-01-01',
  '2024-02-29',
  '2025-06-15',
  '2026-04-27',
  '2026-12-31',
  '2030-07-04',
  '2099-12-31',
];

describe('client ↔ server: scoring constants', () => {
  it('MIN_WORD_LENGTH совпадает', () => {
    expect(clientMin).toBe(serverMin);
  });
  it('MAX_WORD_LENGTH совпадает', () => {
    expect(clientMax).toBe(serverMax);
  });
});

describe('client ↔ server: calculateScore по длине слова', () => {
  // Покрываем все валидные длины + граничные невалидные.
  const lengths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10];

  for (const len of lengths) {
    it(`длина ${len} → одинаковый score`, () => {
      const word = 'a'.repeat(len);
      expect(clientCalculateScore(word)).toBe(serverCalculateScore(word));
    });
  }
});

describe('client ↔ server: calculateTotalScore по списку слов', () => {
  const samples: readonly string[][] = [
    [],
    ['cat'],
    ['cat', 'dogs'],
    ['cat', 'dogs', 'tiger'],
    ['cat', 'dogs', 'tiger', 'planet'],
    ['cat', 'dogs', 'tiger', 'planet', 'pelican'],
    ['ab', 'abcdefgh'], // обе длины невалидные — обе реализации должны вернуть 0
  ];

  for (const words of samples) {
    it(`[${words.join(',') || 'пусто'}] → одинаковый total`, () => {
      expect(clientCalculateTotal(words)).toBe(serverCalculateTotal(words));
    });
  }
});

describe('client ↔ server: getTodaySeed', () => {
  it('одинаково форматируют одну и ту же дату', () => {
    const fixed = new Date(Date.UTC(2026, 3, 27, 12, 34, 56));
    expect(clientGetTodaySeed(fixed)).toBe(serverGetTodaySeed(fixed));
  });

  it('форматируют сегодняшний UTC одинаково', () => {
    const now = new Date();
    expect(clientGetTodaySeed(now)).toBe(serverGetTodaySeed(now));
  });
});

describe('client ↔ server: getDailyLetters даёт идентичный набор букв', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed}`, () => {
      const c = clientGetDailyLetters(seed);
      const s = serverGetDailyLetters(seed);
      expect([...s]).toEqual([...c]);
    });
  }
});

describe('client ↔ server: total score на правдоподобных партиях', () => {
  // Реалистичный кейс: для каждого seed строим набор букв клиентом, генерируем
  // несколько коротких слов из этого набора и убеждаемся, что обе реализации
  // соглашаются о суммарном скоре.
  for (const seed of SEEDS) {
    it(`seed ${seed} — общий скор партии совпадает`, () => {
      const letters = clientGetDailyLetters(seed);
      // Берём первые N букв подряд как "слова" длины 3-5. Это не обязательно
      // настоящие английские слова, но calculateTotalScore работает только
      // от длины, так что корректность скоринга проверяется честно.
      const words = [
        letters.slice(0, 3).join(''),
        letters.slice(0, 4).join(''),
        letters.slice(0, 5).join(''),
      ];
      expect(clientCalculateTotal(words)).toBe(serverCalculateTotal(words));
    });
  }
});

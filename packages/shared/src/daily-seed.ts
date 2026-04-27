// Детерминированная генерация 7 букв на дату.
// Все игроки мира в один и тот же UTC-день получают одинаковый набор.

import type { DailySeed, Letters } from './types.js';

// Частоты букв в английском (примерные, в %). Используются для взвешенного сэмпла,
// чтобы наборы выглядели «играбельно», а не как `xqzjvk`.
const LETTER_FREQUENCY: Readonly<Record<string, number>> = {
  e: 12.7, t: 9.1, a: 8.2, o: 7.5, i: 7.0, n: 6.7, s: 6.3, h: 6.1,
  r: 6.0, d: 4.3, l: 4.0, c: 2.8, u: 2.8, m: 2.4, w: 2.4, f: 2.2,
  g: 2.0, y: 2.0, p: 1.9, b: 1.5, v: 1.0, k: 0.8,
  j: 0.15, x: 0.15, q: 0.10, z: 0.07,
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const TOTAL_LETTERS = 7;
const MIN_VOWELS = 3; // 7 уникальных букв с 3+ гласными — стабильно 30-60+ слов

// FNV-1a 32-bit — простой и детерминированный хэш строки
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// mulberry32 — компактный PRNG, достаточный для casual-нужд
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(rng: () => number, weights: Readonly<Record<string, number>>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  const r = rng() * total;
  let acc = 0;
  for (const [letter, weight] of entries) {
    acc += weight;
    if (r <= acc) return letter;
  }
  return entries[0]![0]; // теоретически недостижим, нужен только для TS
}

export function getTodaySeed(date: Date = new Date()): DailySeed {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDailyLetters(seed: DailySeed): Letters {
  const rng = mulberry32(hashSeed(seed));
  const used = new Set<string>();
  const letters: string[] = [];

  // Сначала набираем MIN_VOWELS уникальных гласных
  const vowelWeights: Record<string, number> = {};
  for (const [l, w] of Object.entries(LETTER_FREQUENCY)) {
    if (VOWELS.has(l)) vowelWeights[l] = w;
  }
  while (letters.length < MIN_VOWELS) {
    const v = weightedPick(rng, vowelWeights);
    if (!used.has(v)) {
      letters.push(v);
      used.add(v);
    }
  }

  // Добираем оставшиеся слоты любыми буквами, тоже без повторов
  while (letters.length < TOTAL_LETTERS) {
    const l = weightedPick(rng, LETTER_FREQUENCY);
    if (!used.has(l)) {
      letters.push(l);
      used.add(l);
    }
  }

  // Fisher-Yates — чтобы гласные не оседали в начале
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [letters[i], letters[j]] = [letters[j]!, letters[i]!];
  }

  return Object.freeze(letters);
}

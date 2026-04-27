// Runtime API словаря.
// Словарь грузится лениво (dynamic import) и кэшируется в Set для O(1) lookup.
// Vite вынесет JSON в отдельный chunk, чтобы не раздувать initial bundle.

let cachedSet: Set<string> | null = null;
let pendingLoad: Promise<Set<string>> | null = null;

export async function loadDictionary(): Promise<Set<string>> {
  if (cachedSet) return cachedSet;
  if (pendingLoad) return pendingLoad;

  pendingLoad = (async () => {
    const mod = await import('../data/english.json', { with: { type: 'json' } });
    // JSON-модули по дефолту экспортируют через `default`
    const words = (mod.default ?? mod) as readonly string[];
    cachedSet = new Set(words);
    pendingLoad = null;
    return cachedSet;
  })();

  return pendingLoad;
}

export function isValidWord(word: string, dict: Set<string>): boolean {
  return dict.has(word.toLowerCase());
}

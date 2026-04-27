#!/usr/bin/env node
// Заливает english.json в public.dictionary_words в Supabase.
// Запуск из корня репо: `npm run seed:dictionary` (он передаст --env-file=.env.local).
// Идемпотентный: если в таблице уже есть строки, выходит без изменений.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, '../data/english.json');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  console.error('Run via `npm run seed:dictionary` from repo root, with values in .env.local.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Reading ${dataPath}…`);
const words = JSON.parse(await readFile(dataPath, 'utf-8'));
console.log(`Loaded ${words.length} words from JSON.`);

const head = await supabase
  .from('dictionary_words')
  .select('*', { count: 'exact', head: true });

if (head.error) {
  console.error(`Cannot read dictionary_words: ${head.error.message}`);
  process.exit(1);
}

const existing = head.count ?? 0;
console.log(`Existing rows in dictionary_words: ${existing}`);

if (existing > 0) {
  console.log('Already populated — skipping. Truncate the table first if you want to reseed.');
  process.exit(0);
}

const BATCH = 5000;
let inserted = 0;
const started = Date.now();

for (let i = 0; i < words.length; i += BATCH) {
  const chunk = words.slice(i, i + BATCH).map((word) => ({ word }));
  const { error } = await supabase.from('dictionary_words').insert(chunk);
  if (error) {
    console.error(`Batch starting at ${i} failed: ${error.message}`);
    process.exit(1);
  }
  inserted += chunk.length;
  console.log(`Inserted ${inserted}/${words.length}`);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log(`Done. ${inserted} words in ${elapsed}s.`);

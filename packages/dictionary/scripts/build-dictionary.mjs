// Скрипт сборки английского словаря из SCOWL.
// Запускать: `npm run build:data -w @word-royale/dictionary`
// На выходе: data/english.json — отсортированный массив слов длины 3-7, lowercase a-z.

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const TMP_DIR = resolve(PKG_ROOT, '.tmp');
const DATA_DIR = resolve(PKG_ROOT, 'data');
const OUT_FILE = resolve(DATA_DIR, 'english.json');

// SCOWL release: см. http://wordlist.aspell.net/
const SCOWL_VERSION = '2020.12.07';
const SCOWL_URL = `https://downloads.sourceforge.net/project/wordlist/SCOWL/${SCOWL_VERSION}/scowl-${SCOWL_VERSION}.tar.gz`;

// Уровни «насколько знакомо слово»:
// 10 = все знают, 20 = почти все, 35 = частые, 40 = средние, 50 = знают большинство,
// 55 = знают некоторые. Дальше (60+) — слишком редкие для casual-игры.
const SCOWL_LEVELS = ['10', '20', '35', '40', '50', '55'];

// SCOWL делит на варианты: american, british, canadian, australian, english.
// Мы берём british + american + english (общие) — этого достаточно для широкой аудитории.
const SCOWL_DIALECTS = ['american', 'british', 'english'];

const MIN_LEN = 3;
const MAX_LEN = 7;
const ONLY_LOWERCASE_AZ = /^[a-z]+$/;

async function downloadAndExtract() {
  await mkdir(TMP_DIR, { recursive: true });
  const tarPath = resolve(TMP_DIR, 'scowl.tar.gz');
  const extractedDir = resolve(TMP_DIR, `scowl-${SCOWL_VERSION}`);

  if (existsSync(extractedDir)) {
    console.log(`[scowl] using cached ${extractedDir}`);
    return extractedDir;
  }

  if (!existsSync(tarPath)) {
    console.log(`[scowl] downloading ${SCOWL_URL}`);
    execSync(`curl -fsSL -o "${tarPath}" "${SCOWL_URL}"`, { stdio: 'inherit' });
  }

  console.log(`[scowl] extracting`);
  execSync(`tar -xzf "${tarPath}" -C "${TMP_DIR}"`, { stdio: 'inherit' });
  return extractedDir;
}

async function readWordList(filePath) {
  if (!existsSync(filePath)) return [];
  // SCOWL файлы в Latin-1 / ISO-8859-1 (для умляутов и т.п.). Мы всё равно
  // отфильтруем не-ASCII буквы дальше, поэтому читаем как latin1.
  const content = await readFile(filePath, 'latin1');
  return content.split('\n').map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const root = await downloadAndExtract();
  const finalDir = resolve(root, 'final');

  const collected = new Set();
  const stats = { rawTotal: 0, filtered: 0 };

  for (const dialect of SCOWL_DIALECTS) {
    for (const level of SCOWL_LEVELS) {
      const file = resolve(finalDir, `${dialect}-words.${level}`);
      const words = await readWordList(file);
      stats.rawTotal += words.length;
      for (const raw of words) {
        const w = raw.toLowerCase();
        if (w.length < MIN_LEN || w.length > MAX_LEN) continue;
        if (!ONLY_LOWERCASE_AZ.test(w)) continue;
        collected.add(w);
      }
    }
  }

  const sorted = [...collected].sort();
  stats.filtered = sorted.length;

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(sorted));

  const sizeKB = (await readFile(OUT_FILE)).byteLength / 1024;
  console.log(`[scowl] raw entries scanned: ${stats.rawTotal}`);
  console.log(`[scowl] words after filter (${MIN_LEN}-${MAX_LEN} a-z): ${stats.filtered}`);
  console.log(`[scowl] wrote ${OUT_FILE} (${sizeKB.toFixed(1)} KB)`);

  // Чистим .tmp если хотим — но кэш полезен для повторных билдов.
  // await rm(TMP_DIR, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

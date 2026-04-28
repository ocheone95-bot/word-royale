// Раньше тут был дубль игровой логики — Deno-бандлер не любил
// .js-импорты в TS-файлах внутри @word-royale/shared. Теперь shared
// перешёл на .ts extensions (allowImportingTsExtensions=true), и Deno
// читает прямой relative-путь к исходникам без npm-пакета.
//
// Этот файл оставлен только как re-export для обратной совместимости —
// submit-score не нужно править под новый путь.

export * from '../../../packages/shared/src/index.ts';

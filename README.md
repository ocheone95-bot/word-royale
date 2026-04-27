# Word Royale

Telegram Mini App — casual word puzzle. 90 секунд, 7 ежедневных букв, глобальный лидерборд.

> **Источник правды о проекте:** [PROJECT.md](./PROJECT.md). Прочитай его до начала работы.

## Stack

React 18 + TypeScript + Vite + Tailwind · Zustand · `@telegram-apps/sdk-react` · Supabase · grammY · Telegram Stars.

## Структура

Monorepo через npm workspaces:

- `apps/miniapp` — React-фронтенд Mini App
- `apps/bot` — Telegram-бот (grammY)
- `packages/shared` — общие типы и утилиты (scoring, daily-seed)
- `packages/dictionary` — словарь
- `supabase/` — миграции и Edge Functions

## Запуск

```bash
npm install
```

Команды для отдельных воркспейсов будут появляться по мере добавления приложений.
См. [PROJECT.md](./PROJECT.md) — раздел Roadmap.

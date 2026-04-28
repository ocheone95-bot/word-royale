// PostHog analytics для бота (Vercel serverless).
// Если POSTHOG_PROJECT_TOKEN не задан — все вызовы no-op (для локальной
// разработки и до выдачи ключа в Vercel env).
//
// flushAt=1 / flushInterval=0 + posthog.shutdown() в конце каждого webhook
// request гарантируют, что событие успеет уйти до завершения serverless invocation.

import { PostHog } from 'posthog-node';

const key = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com';

interface PosthogShim {
  capture: (params: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }) => void;
  identify: (params: {
    distinctId: string;
    properties?: Record<string, unknown>;
  }) => void;
  captureException: (
    error: unknown,
    distinctId?: string,
    properties?: Record<string, unknown>,
  ) => void;
  shutdown: () => Promise<void>;
}

const shim: PosthogShim = {
  capture: () => {},
  identify: () => {},
  captureException: () => {},
  shutdown: async () => {},
};

export const posthog: PosthogShim = key
  ? (new PostHog(key, {
      host,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
    }) as unknown as PosthogShim)
  : shim;

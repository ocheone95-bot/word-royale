// Проверка подписи Telegram WebApp initData по HMAC-SHA256.
// Алгоритм: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// 1) data_check_string = пары "key=value", отсортированные по ключу, через \n,
//    без поля hash.
// 2) secret_key = HMAC_SHA256(key="WebAppData", message=bot_token).
// 3) calculated_hash = HMAC_SHA256(key=secret_key, message=data_check_string).
// 4) calculated_hash == hash из initData → подпись валидна.
//
// Дополнительно проверяем auth_date — initData не должен быть старее 1 часа
// (защита от replay). Telegram переотдаёт свежий initData при каждом запуске
// Mini App, так что у живого пользователя окно никогда не близко к лимиту.

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
  startParam?: string;
  queryId?: string;
}

const DEFAULT_MAX_AGE_SECONDS = 60 * 60;

async function hmacSha256(key: BufferSource, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(signature);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Constant-time string compare, чтобы не утечь информацию через timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyInitData(
  initData: string,
  botToken: string,
  options: { maxAgeSeconds?: number } = {},
): Promise<VerifiedInitData | null> {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  const entries: [string, string][] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    entries.push([key, value]);
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = await hmacSha256(
    new TextEncoder().encode('WebAppData'),
    botToken,
  );
  const calculated = await hmacSha256(secretKey, dataCheckString);
  const calculatedHex = toHex(calculated);

  if (!timingSafeEqual(calculatedHex, hash)) return null;

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) return null;
  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate) || authDate <= 0) return null;

  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > maxAge) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return null;
  }
  if (typeof user.id !== 'number') return null;

  return {
    user,
    authDate,
    startParam: params.get('start_param') ?? undefined,
    queryId: params.get('query_id') ?? undefined,
  };
}

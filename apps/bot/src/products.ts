// Каталог Stars IAP-продуктов. Источник правды для прайса и описаний.
// Используется в /buy_* командах (sendInvoice), pre_checkout_query (валидация
// payload) и successful_payment (зачисление товара).

export type ThemeId = 'neon' | 'retro' | 'sakura' | 'cyberpunk';

export const THEME_IDS: readonly ThemeId[] = [
  'neon',
  'retro',
  'sakura',
  'cyberpunk',
];

export type ProductId =
  | 'replay'
  | 'double_score'
  | 'pro_subscription'
  | `theme_${ThemeId}`;

export interface Product {
  id: ProductId;
  title: string;
  description: string;
  starsAmount: number;
}

export const PRODUCTS: Record<ProductId, Product> = {
  replay: {
    id: 'replay',
    title: 'Extra game today',
    description: "Play today's puzzle one more time and try to beat your score.",
    starsAmount: 50,
  },
  double_score: {
    id: 'double_score',
    title: 'Double score',
    description: 'Multiply the score of your next game today by 2×.',
    starsAmount: 200,
  },
  pro_subscription: {
    id: 'pro_subscription',
    title: 'Word Pro · 30 days',
    description: 'Unlimited daily plays + all themes for one month.',
    starsAmount: 150,
  },
  theme_neon: {
    id: 'theme_neon',
    title: 'Neon theme',
    description: 'Cyan glow letter style for Word Royale. Yours forever.',
    starsAmount: 100,
  },
  theme_retro: {
    id: 'theme_retro',
    title: 'Retro theme',
    description: 'Warm sepia letter style for Word Royale. Yours forever.',
    starsAmount: 100,
  },
  theme_sakura: {
    id: 'theme_sakura',
    title: 'Sakura theme',
    description: 'Pink blossom letter style for Word Royale. Yours forever.',
    starsAmount: 100,
  },
  theme_cyberpunk: {
    id: 'theme_cyberpunk',
    title: 'Cyberpunk theme',
    description: 'Magenta + yellow neon letter style for Word Royale. Yours forever.',
    starsAmount: 100,
  },
};

export function isProductId(value: string): value is ProductId {
  return value in PRODUCTS;
}

export function getProduct(id: ProductId): Product {
  return PRODUCTS[id];
}

export function isThemeProductId(id: ProductId): id is `theme_${ThemeId}` {
  return id.startsWith('theme_');
}

export function themeIdFromProductId(id: `theme_${ThemeId}`): ThemeId {
  return id.slice('theme_'.length) as ThemeId;
}

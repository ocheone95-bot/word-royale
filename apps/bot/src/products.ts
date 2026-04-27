// Каталог Stars IAP-продуктов. Источник правды для прайса и описаний.
// Используется в /buy_* командах (sendInvoice), pre_checkout_query (валидация
// payload) и successful_payment (зачисление товара).

export type ProductId = 'replay';

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
};

export function isProductId(value: string): value is ProductId {
  return value in PRODUCTS;
}

export function getProduct(id: ProductId): Product {
  return PRODUCTS[id];
}

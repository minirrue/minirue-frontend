/* Catalog domain types — shared by dashboard pages */

export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type Gender = 'men' | 'women' | 'unisex';

export type BottleType = 'spray' | 'splash' | 'travel' | 'refill';

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children?: Category[];
}

export interface ProductVariant {
  id: string;
  sku: string;
  sizeMl: number;
  bottleType: BottleType;
  priceAmount: number;
  currency: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  fragranceFamily: string | null;
  gender: Gender | null;
  status: ProductStatus;
  categories: Category[];
  variants: ProductVariant[];
  createdAt: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  brand: string;
  status: ProductStatus;
  variantCount: number;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  createdAt: string;
}

export interface ProductListResponse {
  items: ProductListItem[];
  nextCursor: string | null;
}

export interface CategoryListResponse {
  items: Category[];
}

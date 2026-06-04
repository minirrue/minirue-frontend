import { apiFetch } from '@/lib/api/client';
import type {
  Product,
  ProductListResponse,
  CategoryListResponse,
  ProductVariant,
  ProductStatus,
  Gender,
  BottleType,
} from './types';

/* ── Products ── */

export interface ListProductsParams {
  status?: ProductStatus;
  brand?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export function listProducts(params: ListProductsParams = {}): Promise<ProductListResponse> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.brand) q.set('brand', params.brand);
  if (params.search) q.set('search', params.search);
  if (params.cursor) q.set('cursor', params.cursor);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<ProductListResponse>(`/catalog/products${qs ? `?${qs}` : ''}`, { auth: true });
}

export function getProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/catalog/products/${id}`, { auth: true });
}

export interface CreateProductInput {
  name: string;
  brand: string;
  description?: string;
  fragranceFamily?: string;
  gender?: Gender;
  categoryIds?: string[];
}

export function createProduct(
  input: CreateProductInput,
  idempotencyKey: string,
): Promise<Product> {
  return apiFetch<Product>('/catalog/products', {
    method: 'POST',
    auth: true,
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export interface UpdateProductInput {
  name?: string;
  brand?: string;
  description?: string;
  fragranceFamily?: string;
  gender?: Gender;
  categoryIds?: string[];
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  return apiFetch<Product>(`/catalog/products/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

export function publishProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/catalog/products/${id}/publish`, {
    method: 'POST',
    auth: true,
  });
}

export function archiveProduct(id: string): Promise<Product> {
  return apiFetch<Product>(`/catalog/products/${id}/archive`, {
    method: 'POST',
    auth: true,
  });
}

/* ── Variants ── */

export interface CreateVariantInput {
  sku: string;
  sizeMl: number;
  bottleType: BottleType;
  priceAmount: number;
  currency: string;
}

export function createVariant(
  productId: string,
  input: CreateVariantInput,
): Promise<ProductVariant> {
  return apiFetch<ProductVariant>(`/catalog/products/${productId}/variants`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

/* ── Categories ── */

export function listCategories(): Promise<CategoryListResponse> {
  return apiFetch<CategoryListResponse>('/catalog/categories', { auth: true });
}

export interface CreateCategoryInput {
  name: string;
  slug: string;
  parentId?: string;
  sortOrder?: number;
}

export function createCategory(input: CreateCategoryInput) {
  return apiFetch<import('./types').Category>('/catalog/categories', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  sortOrder?: number;
}

export function updateCategory(id: string, input: UpdateCategoryInput) {
  return apiFetch<import('./types').Category>(`/catalog/categories/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(input),
  });
}

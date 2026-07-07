// Customer hooks
export {
  useCustomerProfile,
  useUpdateCustomerProfile,
  useCustomerAddresses,
  useCreateCustomerAddress,
  useDeleteCustomerAddress,
  useSetDefaultCustomerAddress,
  CUSTOMER_PROFILE_KEY,
  CUSTOMER_ADDRESSES_KEY,
} from './use-customer';

// Auth hooks
export { useLogin, useRegister, useLogout, useUser } from './use-auth';

// Catalog hooks
export {
  useProducts,
  useProductDetail,
  useProductBySlug,
  useSearchProducts,
  useCategories,
  type Product,
  type ProductVariant,
  type ProductMedia,
  type Category,
  type ProductFilters,
  type ProductsListResponse,
} from './use-catalog';

// Cart hooks
export {
  useCart,
  useAddCartItem,
  useUpdateCartItem,
  useRemoveCartItem,
  useClearCart,
  type Cart,
  type CartItem,
  type AddCartItemRequest,
  type UpdateCartItemRequest,
} from './use-cart';

// Orders hooks
export {
  useOrders,
  useOrderDetail,
  useCreateOrder,
  useCancelOrder,
  type Order,
  type OrderItem,
  type CreateOrderRequest,
  type OrderFilters,
} from './use-orders';

// Query client
export { createQueryClient, getQueryClient } from './query-client';
export { RootQueryProvider } from './query-provider';

// Query‑options factories (shared by server prefetch and client hooks)
export {
  productsQueryOptions,
  productBySlugQueryOptions,
  categoriesQueryOptions,
  searchProductsQueryOptions,
} from './queries';

import ShopRouteSkeleton from '@/components/storefront/ShopRouteSkeleton';

/** See ShopRouteSkeleton — this boundary is what makes a tap paint instantly
 *  AND what gives Next's prefetch something to fetch on a dynamic route. */
export default function Loading() {
  return <ShopRouteSkeleton />;
}

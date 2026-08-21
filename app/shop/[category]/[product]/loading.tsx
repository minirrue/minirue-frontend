import ShopRouteSkeleton from '@/components/storefront/ShopRouteSkeleton';

/**
 * A product page's shell.
 *
 * `count={2}` rather than a bespoke gallery-and-details skeleton: the shopper
 * sees this for a few hundred milliseconds, and two card-shaped blocks read as
 * "the image and the details are coming" without a second layout to keep in
 * step with the real page. See ShopRouteSkeleton for why the boundary exists.
 */
export default function Loading() {
  return <ShopRouteSkeleton count={2} />;
}

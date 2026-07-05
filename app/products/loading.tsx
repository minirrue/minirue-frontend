import CatalogProductGridSkeleton from '@/components/storefront/CatalogProductGridSkeleton';

export default function ProductsLoading() {
  return (
    <div style={{ paddingTop: 'var(--mr-sp-2)' }}>
      <CatalogProductGridSkeleton count={8} />
    </div>
  );
}

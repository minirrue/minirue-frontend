/** Only assisted purchases carry salesMode; legacy/storefront orders have no label. */
export default function OrderSourceLabel({ salesMode }: { salesMode?: 'GROUND' | 'ONLINE' | null }) {
  if (!salesMode) return null;
  return <span style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: 'var(--mr-fg-2)' }}>
    {salesMode === 'GROUND' ? 'Bought at Ground' : 'Assisted online'}
  </span>;
}

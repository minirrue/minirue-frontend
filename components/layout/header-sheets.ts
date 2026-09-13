/**
 * The header's closed overlays, split out so they load after the page does (#76).
 * Imported ONLY through `import()` in Header.tsx — see lib/hooks/useIdleImport.ts
 * and root-bundle-guard.test.ts, which fails if a static import brings them back.
 */
export { default as MobileNavSheet } from '@/components/layout/MobileNavSheet';
export { default as NavCategorySheet } from '@/components/layout/NavCategorySheet';
export { default as SearchSheet } from '@/components/layout/SearchSheet';

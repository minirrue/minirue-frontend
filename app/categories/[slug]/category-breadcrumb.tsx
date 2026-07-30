import Link from 'next/link';
import { Fragment } from 'react';
import type { Category } from '@/lib/api/catalog';

/**
 * Finds a category by slug in a flat+nested tree and returns its full
 * ancestry, root-first, ending with the matched category itself — e.g.
 * `[Jewellery, Rings]` for a "Rings" category nested under "Jewellery".
 * `null` when no category has this slug. Replaces the old `findCategory`,
 * which returned only the leaf and gave the breadcrumb nothing to build a
 * nested trail from.
 */
export function findCategoryPath(
  categories: Category[],
  slug: string,
  path: Category[] = [],
): Category[] | null {
  for (const c of categories) {
    const nextPath = [...path, c];
    if (c.slug === slug) return nextPath;
    if (c.children?.length) {
      const found = findCategoryPath(c.children, slug, nextPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * The visible Home / Shop / <ancestors...> / <category> trail. Pulled out as
 * its own named export so the route logic (ancestry from the catalogue API,
 * never a fixed word) is testable without also mounting Header/Footer.
 */
export function CategoryBreadcrumb({
  ancestors,
  displayName,
}: {
  ancestors: Category[];
  displayName: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      data-trace-id="PG-STOREFRONT-CAT-001::EL-REGION-breadcrumb-navigation"
      style={{
        fontFamily: 'var(--mr-font-label)',
        fontSize: 'var(--mr-text-xs)',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--mr-fg-4)',
        marginBottom: 'var(--mr-sp-6)',
      }}
    >
      <ol
        style={{
          display: 'flex',
          gap: 'var(--mr-sp-2)',
          alignItems: 'center',
          flexWrap: 'wrap',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        <li>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Home
          </Link>
        </li>
        <span aria-hidden="true">/</span>
        <li>
          <Link href="/products" style={{ color: 'inherit', textDecoration: 'none' }}>
            Shop
          </Link>
        </li>
        {ancestors.map((a) => (
          <Fragment key={a.id}>
            <span aria-hidden="true">/</span>
            <li>
              <Link
                href={`/categories/${a.slug}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {a.name}
              </Link>
            </li>
          </Fragment>
        ))}
        <span aria-hidden="true">/</span>
        <li>
          <span style={{ color: 'var(--mr-fg-2)' }}>{displayName}</span>
        </li>
      </ol>
    </nav>
  );
}

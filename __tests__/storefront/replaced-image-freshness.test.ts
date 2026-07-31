import { catalog } from '@/lib/api/catalog';
import { categoriesQueryOptions } from '@/lib/hooks/queries';

/**
 * "The thumbnail should be refreshed with the new exchanged one" (owner,
 * 2026-07-31).
 *
 * The backend already does its half correctly: a replacement is written under
 * a NEW uuid-suffixed key and every read re-resolves it, so the url the API
 * returns is right the instant the exchange finishes. What the shopper sees is
 * governed entirely by how long the storefront keeps handing out the OLD one.
 *
 * For a category tile that used to be Next's Data Cache (`revalidate: 300`)
 * layered under React Query's `staleTime` — which was THIRTY MINUTES. So an
 * admin who replaced a category picture could watch the shop keep showing the
 * previous one for well over half an hour, and (before the backend began
 * retaining replaced objects) showing a BROKEN one for that whole window,
 * because the object behind the old url had already been deleted.
 *
 * These pin both layers at a minute. Nothing here is a magic number for its
 * own sake: `REPLACED_OBJECT_RETENTION_MS` in the backend
 * (`src/storage/storage.service.ts`) is what guarantees the old object still
 * exists for the whole staleness window, and these bounds are what keep that
 * window far inside it. Raising either without raising that is what
 * reintroduces the broken tile.
 */

/** The backend retains a replaced object for one hour before binning it. */
const BACKEND_REPLACED_OBJECT_RETENTION_MS = 60 * 60 * 1000;

/** How long a replaced picture may keep showing the previous photo. */
const MAX_ACCEPTABLE_STALENESS_MS = 60 * 1000;

describe('a replaced category picture refreshes on the storefront', () => {
  it('does not hold the client-side categories cache longer than a minute', () => {
    const { staleTime } = categoriesQueryOptions();
    expect(staleTime).toBeLessThanOrEqual(MAX_ACCEPTABLE_STALENESS_MS);
  });

  it('does not hold the server-side Data Cache for categories longer than a minute', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await catalog.listCategories();
    } finally {
      global.fetch = original;
    }

    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0][1] as {
      next?: { revalidate?: number | false };
    };
    expect(typeof init?.next?.revalidate).toBe('number');
    expect(init.next!.revalidate).toBeLessThanOrEqual(
      MAX_ACCEPTABLE_STALENESS_MS / 1000,
    );
  });

  it('every layer of staleness still fits inside the window the backend keeps the replaced object alive for', () => {
    const { staleTime } = categoriesQueryOptions();
    // Worst case a shopper sees the old url: the Data Cache entry was written
    // the instant before the replacement, and the client then sat on it for a
    // full staleTime on top. Both together must clear well before the backend
    // deletes the object that url points at, or the tile goes BROKEN rather
    // than merely stale.
    const worstCaseStaleMs = MAX_ACCEPTABLE_STALENESS_MS + (staleTime as number);
    expect(worstCaseStaleMs).toBeLessThan(BACKEND_REPLACED_OBJECT_RETENTION_MS);
  });
});

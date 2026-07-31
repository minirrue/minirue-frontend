/**
 * Owner report (2026-07-31): "still my avatar shows generic avatar although i
 * have uploaded my avatar on customer account normally." — the upload
 * succeeds; the question is whether a later READ of the profile reflects it.
 *
 * End-to-end diagnosis (see .superpowers/sdd/2026-07-30-qc-pass-2/task-FF-report.md)
 * found every link in the chain intact: the backend persists and reads back
 * `customerProfiles.avatarUrl` correctly (proved against a real local
 * Postgres in customer-avatar-roundtrip.db.spec.ts), the frontend's
 * `CustomerProfile` type carries `avatarUrl`, `apiGetMe`/`apiUploadMyAvatar`
 * hit the right endpoints, and `ProfileForm` renders strictly on
 * `profile.avatarUrl`'s truthiness. These tests pin that contract down so a
 * future regression here fails a test instead of only surfacing as a report.
 *
 * Also covers the standing rule: the generic icon must appear ONLY when
 * there truly is no photo — a photo that exists but fails to load must be
 * visibly distinguishable from "no photo on file", never silently masked as
 * the icon.
 */

import React from 'react';
import { act } from 'react';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CustomerProfile } from '@/lib/api/customers';

const mockApiGetMe = jest.fn();
const mockApiUploadMyAvatar = jest.fn();
const mockApiUpdateMe = jest.fn();

jest.mock('@/lib/api/customers', () => ({
  apiGetMe: (...args: unknown[]) => mockApiGetMe(...args),
  apiUploadMyAvatar: (...args: unknown[]) => mockApiUploadMyAvatar(...args),
  apiUpdateMe: (...args: unknown[]) => mockApiUpdateMe(...args),
}));

// Bypasses the real crop UI — canvas.toBlob() isn't implemented in jsdom, and
// what this suite is proving is the upload -> persist -> read -> render
// chain, not the cropper itself (which has its own coverage elsewhere).
// Mirrors the dashboard tests' pattern of stubbing the crop step directly.
jest.mock('@/components/storefront/AvatarCropSheet', () => ({
  __esModule: true,
  default: ({
    open,
    onCropped,
  }: {
    open: boolean;
    onCropped: (blob: Blob) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => onCropped(new Blob(['fake-cropped-bytes'], { type: 'image/jpeg' }))}
      >
        confirm-crop
      </button>
    ) : null,
}));

import ProfileForm from '@/app/account/profile/ProfileForm';
import ProfilePageClient from '@/app/account/profile/ProfilePageClient';

function baseProfile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    customerId: 'cust-1',
    firstName: 'Nour',
    lastName: 'Hassan',
    displayName: null,
    phone: '+201001234567',
    phoneSearchHash: null,
    avatarUrl: null,
    emailVerified: true,
    tier: 'BRONZE',
    lifetimeSpendAmount: '0',
    lifetimeSpendCurrency: 'EGP',
    gdprEraseRequestedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    addresses: [],
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('customer avatar — upload then re-read shows the photo, never the generic icon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the generic icon ONLY when there truly is no photo on file', () => {
    const { container } = renderWithClient(
      <ProfileForm profile={baseProfile({ avatarUrl: null })} />,
    );
    expect(screen.getByTestId('avatar-generic')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('after a successful upload, the photo renders immediately — never the icon, never broken', async () => {
    const uploadedUrl = 'https://cdn.example.com/customers/avatar-abc.webp';
    mockApiUploadMyAvatar.mockResolvedValue(baseProfile({ avatarUrl: uploadedUrl }));

    const { container } = renderWithClient(
      <ProfileForm profile={baseProfile({ avatarUrl: null })} />,
    );

    const user = userEvent.setup();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['bytes'], 'me.jpg', { type: 'image/jpeg' });
    await user.upload(fileInput, file);

    await user.click(await screen.findByText('confirm-crop'));

    await waitFor(() => expect(mockApiUploadMyAvatar).toHaveBeenCalledTimes(1));

    // The photo is showing from LOCAL bytes (the object URL this component
    // owns), and the generic icon never comes back once a photo exists.
    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toMatch(/^blob:/);
    });
    expect(screen.queryByTestId('avatar-generic')).toBeNull();
  });

  it('a fresh read of the profile (simulating a reload after upload) renders the persisted avatarUrl as the photo, not the icon', async () => {
    const persistedUrl = 'https://cdn.example.com/customers/avatar-real.webp';
    mockApiGetMe.mockResolvedValue(baseProfile({ avatarUrl: persistedUrl }));

    const { container } = renderWithClient(<ProfilePageClient />);

    await waitFor(() => expect(mockApiGetMe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());

    const img = container.querySelector('img') as HTMLImageElement;
    // No local bytes exist on a fresh mount — this is the plain read path,
    // rendering exactly the URL the (simulated) re-fetch returned.
    expect(img.getAttribute('src')).toBe(persistedUrl);
    expect(screen.queryByTestId('avatar-generic')).toBeNull();
  });

  it('a photo that fails to load shows a retry affordance — never silently falls back to "no photo"', async () => {
    jest.useFakeTimers();
    try {
      const brokenUrl = 'https://cdn.example.com/customers/avatar-broken.webp';
      const { container } = renderWithClient(
        <ProfileForm profile={baseProfile({ avatarUrl: brokenUrl })} />,
      );

      let img = container.querySelector('img');
      expect(img).not.toBeNull();

      // Fail every attempt. Each failure schedules a backoff retry except the
      // last, which gives up immediately — advancing generously after each
      // dispatch covers both cases without needing the exact delay.
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = container.querySelector('img');
        act(() => {
          current?.dispatchEvent(new Event('error'));
        });
        act(() => {
          jest.advanceTimersByTime(10_000);
        });
      }

      img = container.querySelector('img');
      expect(img).toBeNull(); // no longer an <img> at all — a retry affordance instead
      expect(screen.queryByTestId('avatar-generic')).toBeNull();
      expect(screen.getByText(/couldn't load/i)).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});

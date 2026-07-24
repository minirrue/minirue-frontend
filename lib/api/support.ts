'use client';

import { getGuestSupport } from '@/lib/support/session';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

// Logged-in customers authenticate via the httpOnly session cookie (sent with
// credentials:'include' below); guests carry the x-guest-token header. No
// bearer token is read from JS anymore.
function identityHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const guest = getGuestSupport();
  if (guest) h['x-guest-token'] = guest.guestToken;
  return h;
}

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json', ...identityHeaders() };
}

// Every support call includes credentials so the session cookie rides along.
const CREDS: RequestCredentials = 'include';

export interface SupportAttachmentDto {
  url: string;
  kind: 'image';
}

export interface SupportMessageDto {
  id: string;
  conversationId: string;
  body: string;
  senderType: 'CUSTOMER' | 'GUEST' | 'AGENT' | 'SYSTEM' | string;
  senderName?: string | null;
  createdAt: string;
  attachments?: SupportAttachmentDto[];
}

export interface SupportMetaDto {
  status: 'ONLINE' | 'IDLE' | 'AWAY' | 'OFFLINE';
  replyTimeText: string | null;
}

export interface SupportConversationDto {
  id: string;
  type: 'ITEM' | 'GENERAL' | string;
  status?: string;
  productId?: string | null;
  orderId?: string | null;
  subjectSnapshot?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StartSupportInput {
  type: 'ITEM' | 'GENERAL';
  productId?: string;
  orderId?: string;
  subjectSnapshot?: Record<string, unknown>;
  guest?: { name: string; email: string; phoneCountry: string; phone: string };
  body: string;
  attachments?: SupportAttachmentDto[];
}

export interface StartSupportResult {
  conversation: SupportConversationDto;
  message: SupportMessageDto;
  guestToken?: string;
}

export async function apiStartSupport(input: StartSupportInput): Promise<StartSupportResult> {
  const res = await fetch(`${BASE}/storefront/support/conversations`, {
    method: 'POST',
    headers: headers(),
    credentials: CREDS,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('start failed');
  return res.json() as Promise<StartSupportResult>;
}

export async function apiSupportMine(): Promise<SupportConversationDto[]> {
  try {
    const res = await fetch(`${BASE}/storefront/support/conversations/mine`, { headers: headers(), credentials: CREDS });
    if (!res.ok) return [];
    return (await res.json()) as SupportConversationDto[];
  } catch {
    return [];
  }
}

/**
 * Merges the guest thread into the logged-in customer's existing thread and
 * resolves to the surviving conversation's id. Resolves to `null` on any
 * failure (network error, non-ok response, missing conversation) — never
 * throws, so the caller can safely treat `null` as "claim did not happen"
 * and keep the guest token around for a later retry.
 */
export async function apiSupportClaim(): Promise<{ id: string } | null> {
  try {
    const res = await fetch(`${BASE}/storefront/support/claim`, {
      method: 'POST',
      headers: headers(),
      credentials: CREDS,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { conversation: SupportConversationDto | null };
    const id = data?.conversation?.id;
    return id ? { id } : null;
  } catch {
    return null;
  }
}

export async function apiSupportMessages(id: string, after?: string): Promise<SupportMessageDto[]> {
  const res = await fetch(
    `${BASE}/storefront/support/conversations/${id}/messages${after ? `?after=${after}` : ''}`,
    { headers: headers(), credentials: CREDS },
  );
  if (!res.ok) throw new Error('messages failed');
  return res.json() as Promise<SupportMessageDto[]>;
}

export async function apiSendSupport(
  id: string,
  body: string,
  attachments?: SupportAttachmentDto[],
): Promise<SupportMessageDto> {
  const res = await fetch(`${BASE}/storefront/support/conversations/${id}/messages`, {
    method: 'POST',
    headers: headers(),
    credentials: CREDS,
    body: JSON.stringify({ body, ...(attachments && attachments.length > 0 ? { attachments } : {}) }),
  });
  if (!res.ok) throw new Error('send failed');
  return res.json() as Promise<SupportMessageDto>;
}

export async function apiSupportMeta(): Promise<SupportMetaDto | null> {
  try {
    const res = await fetch(`${BASE}/storefront/support/meta`);
    if (!res.ok) return null;
    return (await res.json()) as SupportMetaDto;
  } catch {
    return null;
  }
}

/**
 * Presence heartbeat: reports this customer's tab state for `conversationId` —
 * 'active' (tab focused) reads ONLINE, 'idle' (tab backgrounded) reads IDLE.
 * The widget polls this (Vercel hobby kills WebSockets); when pings stop
 * entirely (tab closed) the backend TTL lapses to OFFLINE. Best-effort — never
 * throws.
 */
export async function apiSupportHeartbeat(
  conversationId: string,
  state: 'active' | 'idle',
): Promise<void> {
  try {
    await fetch(`${BASE}/storefront/support/heartbeat`, {
      method: 'POST',
      headers: headers(),
      credentials: CREDS,
      body: JSON.stringify({ conversationId, state }),
    });
  } catch {
    // Presence is cosmetic; a dropped heartbeat just means the state is stale
    // until the next tick succeeds.
  }
}

export async function apiSupportUpload(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/storefront/support/uploads`, {
    method: 'POST',
    headers: identityHeaders(),
    credentials: CREDS,
    body: form,
  });
  if (!res.ok) throw new Error('upload failed');
  return res.json() as Promise<{ url: string }>;
}

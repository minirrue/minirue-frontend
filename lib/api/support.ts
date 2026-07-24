'use client';

import { getGuestSupport } from '@/lib/support/session';
import { getAccessToken } from '@/lib/auth/tokens';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

function identityHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const token = getAccessToken?.();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const guest = getGuestSupport();
  if (guest) h['x-guest-token'] = guest.guestToken;
  return h;
}

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json', ...identityHeaders() };
}

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
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('start failed');
  return res.json() as Promise<StartSupportResult>;
}

export async function apiSupportMine(): Promise<SupportConversationDto[]> {
  const res = await fetch(`${BASE}/storefront/support/conversations`, { headers: headers() });
  if (!res.ok) throw new Error('mine failed');
  return res.json() as Promise<SupportConversationDto[]>;
}

export async function apiSupportMessages(id: string, after?: string): Promise<SupportMessageDto[]> {
  const res = await fetch(
    `${BASE}/storefront/support/conversations/${id}/messages${after ? `?after=${after}` : ''}`,
    { headers: headers() },
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

export async function apiSupportUpload(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/storefront/support/uploads`, {
    method: 'POST',
    headers: identityHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error('upload failed');
  return res.json() as Promise<{ url: string }>;
}

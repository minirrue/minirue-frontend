'use client';

import { getGuestSupport } from '@/lib/support/session';
import { getAccessToken } from '@/lib/auth/tokens';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002') + '/v1';

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken?.();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const guest = getGuestSupport();
  if (guest) h['x-guest-token'] = guest.guestToken;
  return h;
}

export interface SupportMessageDto {
  id: string;
  conversationId: string;
  body: string;
  senderType: 'CUSTOMER' | 'GUEST' | 'AGENT' | 'SYSTEM' | string;
  senderName?: string | null;
  createdAt: string;
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

export async function apiSendSupport(id: string, body: string): Promise<SupportMessageDto> {
  const res = await fetch(`${BASE}/storefront/support/conversations/${id}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error('send failed');
  return res.json() as Promise<SupportMessageDto>;
}

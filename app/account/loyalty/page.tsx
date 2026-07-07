import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { apiGetLoyaltyAccount, apiGetLoyaltyTransactions } from '@/lib/api/loyalty';
import type { PointsTxType } from '@/lib/api/loyalty';

export const metadata: Metadata = {
  title: 'Loyalty — My Account — MiniRue',
  robots: 'noindex, nofollow',
};

const TX_LABELS: Record<PointsTxType, string> = {
  EARN_ORDER: 'Earned from Order',
  EARN_SIGNUP: 'Signup Bonus',
  EARN_EMAIL_VERIFIED: 'Email Verified Bonus',
  REDEEM: 'Redeemed',
  DEDUCT_REFUND: 'Refund Deduction',
  EXPIRE: 'Points Expired',
  MANUAL_ADJUST: 'Manual Adjustment',
};

export default async function LoyaltyPage() {
  // Auth-protected route: opt out of static prerender under cacheComponents
  // (middleware already verified the mr-auth cookie; touching the jar here
  // makes the segment dynamic).
  await cookies();

  let account = null;
  let transactions: Awaited<ReturnType<typeof apiGetLoyaltyTransactions>>['data'] = [];

  try {
    account = await apiGetLoyaltyAccount();
  } catch { /* show fallback */ }

  try {
    const res = await apiGetLoyaltyTransactions({ limit: 20 });
    transactions = res.data;
  } catch { /* show empty */ }

  return (
    <>
      <h1
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xl)',
          fontWeight: 600,
          margin: '0 0 28px',
          color: 'var(--mr-fg)',
        }}
      >
        Loyalty
      </h1>

      {account ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 32,
          }}
        >
          {[
            { label: 'Points Balance', value: account.balance.toLocaleString() },
            { label: 'Lifetime Earned', value: account.lifetimeEarned.toLocaleString() },
            { label: 'Lifetime Redeemed', value: account.lifetimeRedeemed.toLocaleString() },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                padding: '16px 18px',
                background: 'var(--mr-bg-raised)',
                border: '1px solid var(--mr-border)',
                borderRadius: 'var(--mr-radius-md)',
              }}
            >
              <div style={{ fontSize: 'var(--mr-text-xs)', fontFamily: 'var(--mr-font-label)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mr-fg-4)', marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontSize: 'var(--mr-text-xl)', fontWeight: 600, color: 'var(--mr-fg)' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: 'var(--mr-sp-5)', background: 'var(--mr-bg-raised)', border: '1px solid var(--mr-border)', borderRadius: 'var(--mr-radius-md)', marginBottom: 32, fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)' }}>
          Unable to load loyalty account.
        </div>
      )}

      <h2 style={{ fontFamily: 'var(--mr-font-label)', fontSize: 'var(--mr-text-sm)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mr-fg-4)', fontWeight: 500, margin: '0 0 14px' }}>
        Transaction History
      </h2>

      {transactions.length === 0 ? (
        <div style={{ padding: 'var(--mr-sp-4)', background: 'var(--mr-bg-raised)', border: '1px solid var(--mr-border)', borderRadius: 'var(--mr-radius-md)', fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg-3)', textAlign: 'center' }}>
          No transactions yet.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--mr-border)', borderRadius: 'var(--mr-radius-md)', overflow: 'hidden' }}>
          {transactions.map((tx, idx) => (
            <div
              key={tx.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 16,
                padding: '12px 18px',
                borderBottom: idx < transactions.length - 1 ? '1px solid var(--mr-hairline)' : 'none',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--mr-text-sm)', color: 'var(--mr-fg)', fontWeight: tx.delta > 0 ? 500 : 400 }}>
                  {TX_LABELS[tx.type] ?? tx.type}
                </div>
                {tx.note && (
                  <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)', marginTop: 2 }}>{tx.note}</div>
                )}
                <div style={{ fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', marginTop: 2 }}>
                  {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ fontSize: 'var(--mr-text-sm)', fontWeight: 600, color: tx.delta > 0 ? 'var(--mr-st-ok-fg, #166534)' : 'var(--mr-st-danger-fg, #b91c1c)', textAlign: 'right' }}>
                {tx.delta > 0 ? '+' : ''}{tx.delta.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

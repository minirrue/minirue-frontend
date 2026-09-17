/**
 * Unit tests — app/account/refunds/RefundsPageClient.tsx
 * Covers: every RefundStatus renders its dashboard-matching label.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockApiListMyRefunds = jest.fn();
const mockApiGetOrder = jest.fn();
const mockApiGetRefundReceipt = jest.fn();

jest.mock("@/lib/api/refunds", () => {
  const actual = jest.requireActual("@/lib/api/refunds");
  return {
    ...actual,
    apiListMyRefunds: (...args: unknown[]) => mockApiListMyRefunds(...args),
    apiGetRefundReceipt: (...args: unknown[]) =>
      mockApiGetRefundReceipt(...args),
  };
});

jest.mock("@/lib/checkout/checkout-api", () => ({
  apiGetOrder: (...args: unknown[]) => mockApiGetOrder(...args),
}));

// ── Component ────────────────────────────────────────────────────────────────
import RefundsPageClient from "@/app/account/refunds/RefundsPageClient";

const ticket = (overrides: Record<string, unknown> = {}) => ({
  id: `t-${Math.random()}`,
  orderId: "order-1",
  customerId: "cust-1",
  method: "ORIGINAL_PAYMENT",
  requestedAmountCents: 45000,
  approvedAmountCents: null,
  reason: "test",
  reasonCode: "DAMAGED_ITEM",
  reasonNote: null,
  adminNote: null,
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  ...overrides,
});

describe("RefundsPageClient — status labels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGetOrder.mockResolvedValue({
      id: "order-1",
      orderNumber: "MR-0001",
      orderSeq: 47,
      status: "REFUNDED",
      totalAmount: "450.00",
      totalCurrency: "EGP",
      items: [],
      createdAt: "2026-07-25T00:00:00.000Z",
      refundedAt: null,
      refundedAmountCents: null,
    });
  });

  it.each([
    ["REQUESTED", "Requested"],
    ["UNDER_REVIEW", "Under review"],
    ["APPROVED", "Approved"],
    ["REFUNDED", "Refunded"],
    ["REJECTED", "Rejected"],
    ["CANCELLED", "Cancelled"],
  ])('renders %s as "%s"', async (status, label) => {
    mockApiListMyRefunds.mockResolvedValue({
      data: [ticket({ id: `t-${status}`, orderId: `order-${status}`, status })],
      total: 1,
    });
    mockApiGetOrder.mockResolvedValueOnce({
      id: `order-${status}`,
      orderNumber: `MR-${status}`,
      orderSeq: 1,
      status: "DELIVERED",
      totalAmount: "450.00",
      totalCurrency: "EGP",
      items: [],
      createdAt: "2026-07-25T00:00:00.000Z",
      refundedAt: null,
      refundedAmountCents: null,
    });

    render(<RefundsPageClient />);

    await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it("shows the empty state when the customer has no refund tickets", async () => {
    mockApiListMyRefunds.mockResolvedValue({ data: [], total: 0 });
    render(<RefundsPageClient />);

    await waitFor(() =>
      expect(screen.getByText("No refund requests yet.")).toBeInTheDocument(),
    );
  });

  it("opens the branded e-receipt and keeps an order link", async () => {
    mockApiListMyRefunds.mockResolvedValue({
      data: [ticket({ id: "refund-1", status: "REFUNDED" })],
      total: 1,
    });
    mockApiGetRefundReceipt.mockResolvedValue({
      refundId: "refund-1",
      orderId: "order-1",
      orderRef: "#47",
      amountCents: 45000,
      currency: "EGP",
      reason: "Item arrived damaged",
      issuedAt: "2026-07-25T00:00:00.000Z",
      logoUrl: "https://cdn.test/logo.png",
      logoShape: "ROUNDED",
    });
    render(<RefundsPageClient />);
    fireEvent.click(
      await screen.findByRole("button", { name: /view e-receipt/i }),
    );
    expect(await screen.findByText("REFUND RECEIPT")).toBeInTheDocument();
    expect(screen.getAllByText("#47")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /open order/i })).toHaveAttribute(
      "href",
      "/account/orders/order-1",
    );
    expect(screen.getByRole("img", { name: "MiniRue" })).toHaveStyle({
      borderRadius: "10px",
    });
  });
});

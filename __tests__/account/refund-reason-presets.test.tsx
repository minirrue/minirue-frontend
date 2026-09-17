import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RefundRequestClient from "@/app/account/orders/[id]/refund/RefundRequestClient";
import CancelButton from "@/app/account/orders/[id]/CancelButton";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockCreateRefund = jest.fn();
const mockCancelOrder = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("@/lib/api/refunds", () => ({
  apiCreateRefund: (...args: unknown[]) => mockCreateRefund(...args),
}));

jest.mock("@/lib/api/orders", () => ({
  apiCancelOrder: (...args: unknown[]) => mockCancelOrder(...args),
}));

describe("refund and cancellation reason presets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRefund.mockResolvedValue({});
    mockCancelOrder.mockResolvedValue({});
  });

  it("submits a preset refund reason instead of free text", async () => {
    render(<RefundRequestClient orderId="order-1" />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "125.50" },
    });
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "WRONG_ITEM" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() =>
      expect(mockCreateRefund).toHaveBeenCalledWith({
        orderId: "order-1",
        method: "ORIGINAL_PAYMENT",
        requestedAmountCents: 12550,
        reasonCode: "WRONG_ITEM",
      }),
    );
  });

  it("requires details when Other is selected for cancellation", async () => {
    render(<CancelButton orderId="order-1" />);
    fireEvent.click(screen.getByRole("button", { name: /cancel order/i }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "OTHER" },
    });
    fireEvent.click(screen.getByRole("button", { name: /yes, cancel/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please tell us why you are cancelling.",
    );
    expect(mockCancelOrder).not.toHaveBeenCalled();
  });
});

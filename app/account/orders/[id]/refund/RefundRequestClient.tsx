"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiCreateRefund,
  type RefundMethod,
  type RefundReasonCode,
} from "@/lib/api/refunds";
import Button from "@/components/ui/Button";

const METHOD_OPTIONS: Array<{ value: RefundMethod; label: string }> = [
  { value: "ORIGINAL_PAYMENT", label: "Original Payment Method" },
  { value: "STORE_CREDIT", label: "Store Credit" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];

const REASON_OPTIONS: Array<{ value: RefundReasonCode; label: string }> = [
  { value: "DAMAGED_ITEM", label: "Item arrived damaged" },
  { value: "WRONG_ITEM", label: "Wrong item received" },
  { value: "MISSING_ITEM", label: "Item missing from my order" },
  { value: "NOT_AS_DESCRIBED", label: "Item was not as described" },
  { value: "LATE_DELIVERY", label: "Delivery arrived too late" },
  { value: "CHANGED_MIND", label: "I changed my mind" },
  { value: "OTHER", label: "Other" },
];

export default function RefundRequestClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reasonCode, setReasonCode] =
    useState<RefundReasonCode>("DAMAGED_ITEM");
  const [reasonNote, setReasonNote] = useState("");
  const [method, setMethod] = useState<RefundMethod>("ORIGINAL_PAYMENT");
  const [amountEgp, setAmountEgp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(amountEgp) * 100);
    if (!cents || cents <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (reasonCode === "OTHER" && reasonNote.trim().length < 3) {
      setError("Please tell us why you need the refund.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiCreateRefund({
        orderId,
        method,
        requestedAmountCents: cents,
        reasonCode,
        ...(reasonNote.trim() ? { reasonNote: reasonNote.trim() } : {}),
      });
      router.push(`/account/orders/${orderId}?refund=requested`);
    } catch (e: unknown) {
      setError(
        (e as { message?: string }).message ??
          "Failed to submit refund request.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <Link
        href={`/account/orders/${orderId}`}
        style={{
          fontSize: "var(--mr-text-xs)",
          fontFamily: "var(--mr-font-label)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--mr-fg-4)",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 28,
        }}
      >
        ← Back to Order
      </Link>

      <h1
        style={{
          fontFamily: "var(--mr-font-label)",
          fontSize: "var(--mr-text-xl)",
          fontWeight: 600,
          margin: "0 0 28px",
          color: "var(--mr-fg)",
        }}
      >
        Request Refund
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div>
          <label
            htmlFor="refund-amount"
            style={{
              display: "block",
              fontSize: "var(--mr-text-xs)",
              fontFamily: "var(--mr-font-label)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--mr-fg-4)",
              marginBottom: 6,
            }}
          >
            Refund Amount (EGP) *
          </label>
          <input
            id="refund-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amountEgp}
            onChange={(e) => setAmountEgp(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid var(--mr-border)",
              borderRadius: "var(--mr-radius-sm)",
              background: "var(--mr-bg-raised)",
              color: "var(--mr-fg)",
              fontSize: "var(--mr-text-sm)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="refund-method"
            style={{
              display: "block",
              fontSize: "var(--mr-text-xs)",
              fontFamily: "var(--mr-font-label)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--mr-fg-4)",
              marginBottom: 6,
            }}
          >
            Refund Method *
          </label>
          <select
            id="refund-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as RefundMethod)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid var(--mr-border)",
              borderRadius: "var(--mr-radius-sm)",
              background: "var(--mr-bg-raised)",
              color: "var(--mr-fg)",
              fontSize: "var(--mr-text-sm)",
              boxSizing: "border-box",
            }}
          >
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="refund-reason"
            style={{
              display: "block",
              fontSize: "var(--mr-text-xs)",
              fontFamily: "var(--mr-font-label)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--mr-fg-4)",
              marginBottom: 6,
            }}
          >
            Reason *
          </label>
          <select
            id="refund-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as RefundReasonCode)}
            style={{
              width: "100%",
              padding: "10px 14px",
              border: "1px solid var(--mr-border)",
              borderRadius: "var(--mr-radius-sm)",
              background: "var(--mr-bg-raised)",
              color: "var(--mr-fg)",
              fontSize: "var(--mr-text-sm)",
              boxSizing: "border-box",
            }}
          >
            {REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {(reasonCode === "OTHER" || reasonNote) && (
          <div>
            <label
              htmlFor="refund-reason-details"
              style={{
                display: "block",
                fontSize: "var(--mr-text-xs)",
                fontFamily: "var(--mr-font-label)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--mr-fg-4)",
                marginBottom: 6,
              }}
            >
              Details {reasonCode === "OTHER" ? "*" : "(optional)"}
            </label>
            <textarea
              id="refund-reason-details"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              required={reasonCode === "OTHER"}
              minLength={reasonCode === "OTHER" ? 3 : undefined}
              maxLength={500}
              rows={3}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid var(--mr-border)",
                borderRadius: "var(--mr-radius-sm)",
                background: "var(--mr-bg-raised)",
                color: "var(--mr-fg)",
                fontSize: "var(--mr-text-sm)",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {error && (
          <p
            style={{
              color: "var(--mr-danger)",
              fontSize: "var(--mr-text-sm)",
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit Request"}
        </Button>
      </form>
    </div>
  );
}

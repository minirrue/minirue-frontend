import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const now = "2026-09-17T06:00:00.000Z";

test("customer can open a branded refund receipt at desktop and mobile widths", async ({
  page,
}) => {
  await mkdir(".impeccable/review", { recursive: true });
  await page
    .context()
    .addCookies([
      { name: "mr-auth", value: "1", url: "http://localhost:3000" },
    ]);
  await page.route("**/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path.endsWith("/storefront/chrome"))
      json = {
        announcement: {
          enabled: false,
          messages: [],
          linkUrl: null,
          background: null,
        },
        productSection: { perks: [] },
        faviconUrl: null,
        shopName: "MiniRue",
        shopLogoUrl: null,
        navbar: { items: [], showSearch: true, showAccount: true },
        mobileMenu: { shortcuts: [], footerButton: null },
        footer: {
          tagline: null,
          newsletterEnabled: false,
          newsletterEyebrow: "",
          newsletterBlurb: "",
          columns: [],
          socials: [],
          paymentBadges: [],
          legalLine: "",
          secondaryLine: "",
        },
      };
    else if (path.endsWith("/auth/get-session"))
      json = {
        user: {
          id: "customer-1",
          name: "Mariam Adel",
          email: "mariam@example.test",
          role: "CUSTOMER",
        },
      };
    else if (path.endsWith("/refunds"))
      json = {
        data: [
          {
            id: "refund-1",
            orderId: "order-1",
            customerId: "customer-1",
            buyerName: "Mariam Adel",
            status: "REFUNDED",
            method: "BANK_TRANSFER",
            source: "ADMIN",
            hasProof: true,
            requestedAmountCents: 45000,
            approvedAmountCents: 45000,
            reason: "Item arrived damaged",
            reasonCode: "DAMAGED_ITEM",
            reasonNote: null,
            adminNote: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        total: 1,
      };
    else if (path.endsWith("/refunds/refund-1/receipt"))
      json = {
        refundId: "refund-1",
        orderId: "order-1",
        orderRef: "#82",
        amountCents: 45000,
        currency: "EGP",
        reason: "Item arrived damaged",
        issuedAt: now,
        logoUrl: "/logo.png",
        logoShape: "ROUNDED",
      };
    else if (path.endsWith("/orders/order-1"))
      json = { id: "order-1", orderNumber: "MR-82", orderSeq: 82 };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(json),
    });
  });

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/account/refunds");
  await page.getByRole("button", { name: /view e-receipt/i }).click();
  await expect(page.getByText("REFUND RECEIPT")).toBeVisible();
  await expect(page.getByRole("link", { name: /open order/i })).toHaveAttribute(
    "href",
    "/account/orders/order-1",
  );
  await page.screenshot({
    path: ".impeccable/review/issue-82-receipt-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
  await page.screenshot({
    path: ".impeccable/review/issue-82-receipt-mobile.png",
    fullPage: true,
  });
});

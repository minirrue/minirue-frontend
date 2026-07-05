import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Cormorant_Garamond, Jost, Inter_Tight } from "next/font/google";
import "./globals.css";
import LenisProvider from "@/components/providers/LenisProvider";
import OrganizationSchema from "@/components/seo/OrganizationSchema";
import { CartProvider } from "@/components/storefront/cart/CartContext";
import CartDrawer from "@/components/storefront/cart/CartDrawer";
import { RootQueryProvider } from "@/lib/hooks";
import SessionExpiredHandler from "@/components/auth/SessionExpiredHandler";
import { apiGetPublicSettings } from "@/lib/api/settings";

const cormorant = Cormorant_Garamond({  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = {
    title: "MiniRue — Original Quality Perfumes",
    description:
      "Worldwide e-commerce for high-premium, original-quality perfume. Discover MiniRue.",
    metadataBase: new URL("https://minirue.com"),
    openGraph: {
      siteName: "MiniRue",
      type: "website",
    },
  };

  try {
    const settings = await apiGetPublicSettings();
    const favicon = settings.storefront.faviconUrl;
    if (favicon) {
      return { ...base, icons: { icon: favicon } };
    }
  } catch {
    // default icons
  }

  return base;
}

export default function RootLayout({  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable} ${interTight.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        style={
          {
            "--mr-font-serif": "var(--font-cormorant), 'Didot', Georgia, serif",
            "--mr-font-label":
              "var(--font-jost), 'Futura', system-ui, sans-serif",
            "--mr-font-ui":
              "var(--font-inter-tight), 'Inter', system-ui, -apple-system, sans-serif",
          } as React.CSSProperties
        }
      >
        <OrganizationSchema />
        <RootQueryProvider>
          <SessionExpiredHandler />
          <CartProvider>
            <LenisProvider>{children}</LenisProvider>
            <CartDrawer />
          </CartProvider>
        </RootQueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

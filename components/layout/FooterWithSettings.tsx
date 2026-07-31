import Footer from './Footer';
import { fetchStorefrontChrome, FALLBACK_CHROME } from '@/lib/api/storefront';

export default async function FooterWithSettings() {
  let footer = FALLBACK_CHROME.footer;
  let shopName = FALLBACK_CHROME.shopName;
  try {
    const chrome = await fetchStorefrontChrome();
    footer = chrome.footer;
    shopName = chrome.shopName;
  } catch {
    // use FALLBACK_CHROME above
  }
  return <Footer config={footer} shopName={shopName} />;
}

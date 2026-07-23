import Footer from './Footer';
import { fetchStorefrontChrome, FALLBACK_CHROME } from '@/lib/api/storefront';

export default async function FooterWithSettings() {
  let footer = FALLBACK_CHROME.footer;
  try {
    const chrome = await fetchStorefrontChrome();
    footer = chrome.footer;
  } catch {
    // use FALLBACK_CHROME.footer above
  }
  return <Footer config={footer} />;
}

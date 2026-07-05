import Footer from './Footer';
import { apiGetPublicSettings } from '@/lib/api/settings';

export default async function FooterWithSettings() {
  let tagline: string | undefined;
  try {
    const settings = await apiGetPublicSettings();
    tagline = settings.storefront.footerTagline ?? undefined;
  } catch {
    // use default copy in Footer
  }
  return <Footer tagline={tagline} />;
}

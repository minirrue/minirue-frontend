'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

const integrationKey =
  process.env.NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY?.trim() || 'ZO0eVJFmYpzTQAAH';

export function shouldLoadTrustpilot(pathname: string): boolean {
  return pathname !== '/checkout' && !pathname.startsWith('/checkout/');
}

export default function TrustpilotIntegration() {
  const pathname = usePathname();

  if (!shouldLoadTrustpilot(pathname)) return null;

  const key = JSON.stringify(integrationKey);
  const bootstrap = `(function (window, document) {
    window.TrustpilotObject = 'tp';
    window.tp = window.tp || function () {
      (window.tp.q = window.tp.q || []).push(arguments);
    };
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://invitejs.trustpilot.com/tp.min.js';
    script.type = 'text/javascript';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
    window.tp('register', ${key});
  })(window, document);`;

  return (
    <Script
      id="minirue-trustpilot-integration"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: bootstrap }}
    />
  );
}

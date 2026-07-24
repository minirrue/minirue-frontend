export interface CountryCode {
  /** ISO 3166-1 alpha-2 code (used as a stable React key). */
  code: string;
  label: string;
  /** International dialing prefix, e.g. "+20". */
  dial: string;
}

/** Default dialing code — Egypt. */
export const DEFAULT_DIAL = '+20';

/**
 * Country dialing codes. Egypt first (default). Kept intentionally broad so the
 * guest contact form covers the storefront's real audience without a heavyweight
 * i18n dependency. Some prefixes (e.g. +1) are shared by several countries; each
 * row keeps its own ISO code so React keys stay unique.
 */
export const COUNTRY_CODES: CountryCode[] = [
  { code: 'EG', label: 'Egypt', dial: '+20' },
  { code: 'SA', label: 'Saudi Arabia', dial: '+966' },
  { code: 'AE', label: 'United Arab Emirates', dial: '+971' },
  { code: 'QA', label: 'Qatar', dial: '+974' },
  { code: 'KW', label: 'Kuwait', dial: '+965' },
  { code: 'BH', label: 'Bahrain', dial: '+973' },
  { code: 'OM', label: 'Oman', dial: '+968' },
  { code: 'JO', label: 'Jordan', dial: '+962' },
  { code: 'LB', label: 'Lebanon', dial: '+961' },
  { code: 'IQ', label: 'Iraq', dial: '+964' },
  { code: 'SY', label: 'Syria', dial: '+963' },
  { code: 'YE', label: 'Yemen', dial: '+967' },
  { code: 'PS', label: 'Palestine', dial: '+970' },
  { code: 'LY', label: 'Libya', dial: '+218' },
  { code: 'TN', label: 'Tunisia', dial: '+216' },
  { code: 'DZ', label: 'Algeria', dial: '+213' },
  { code: 'MA', label: 'Morocco', dial: '+212' },
  { code: 'SD', label: 'Sudan', dial: '+249' },
  { code: 'US', label: 'United States', dial: '+1' },
  { code: 'CA', label: 'Canada', dial: '+1' },
  { code: 'GB', label: 'United Kingdom', dial: '+44' },
  { code: 'IE', label: 'Ireland', dial: '+353' },
  { code: 'FR', label: 'France', dial: '+33' },
  { code: 'DE', label: 'Germany', dial: '+49' },
  { code: 'ES', label: 'Spain', dial: '+34' },
  { code: 'IT', label: 'Italy', dial: '+39' },
  { code: 'PT', label: 'Portugal', dial: '+351' },
  { code: 'NL', label: 'Netherlands', dial: '+31' },
  { code: 'BE', label: 'Belgium', dial: '+32' },
  { code: 'CH', label: 'Switzerland', dial: '+41' },
  { code: 'AT', label: 'Austria', dial: '+43' },
  { code: 'SE', label: 'Sweden', dial: '+46' },
  { code: 'NO', label: 'Norway', dial: '+47' },
  { code: 'DK', label: 'Denmark', dial: '+45' },
  { code: 'FI', label: 'Finland', dial: '+358' },
  { code: 'PL', label: 'Poland', dial: '+48' },
  { code: 'CZ', label: 'Czechia', dial: '+420' },
  { code: 'GR', label: 'Greece', dial: '+30' },
  { code: 'RO', label: 'Romania', dial: '+40' },
  { code: 'HU', label: 'Hungary', dial: '+36' },
  { code: 'RU', label: 'Russia', dial: '+7' },
  { code: 'UA', label: 'Ukraine', dial: '+380' },
  { code: 'TR', label: 'Türkiye', dial: '+90' },
  { code: 'IL', label: 'Israel', dial: '+972' },
  { code: 'IN', label: 'India', dial: '+91' },
  { code: 'PK', label: 'Pakistan', dial: '+92' },
  { code: 'BD', label: 'Bangladesh', dial: '+880' },
  { code: 'CN', label: 'China', dial: '+86' },
  { code: 'JP', label: 'Japan', dial: '+81' },
  { code: 'KR', label: 'South Korea', dial: '+82' },
  { code: 'HK', label: 'Hong Kong', dial: '+852' },
  { code: 'SG', label: 'Singapore', dial: '+65' },
  { code: 'MY', label: 'Malaysia', dial: '+60' },
  { code: 'ID', label: 'Indonesia', dial: '+62' },
  { code: 'PH', label: 'Philippines', dial: '+63' },
  { code: 'TH', label: 'Thailand', dial: '+66' },
  { code: 'VN', label: 'Vietnam', dial: '+84' },
  { code: 'AU', label: 'Australia', dial: '+61' },
  { code: 'NZ', label: 'New Zealand', dial: '+64' },
  { code: 'ZA', label: 'South Africa', dial: '+27' },
  { code: 'NG', label: 'Nigeria', dial: '+234' },
  { code: 'KE', label: 'Kenya', dial: '+254' },
  { code: 'GH', label: 'Ghana', dial: '+233' },
  { code: 'ET', label: 'Ethiopia', dial: '+251' },
  { code: 'BR', label: 'Brazil', dial: '+55' },
  { code: 'MX', label: 'Mexico', dial: '+52' },
  { code: 'AR', label: 'Argentina', dial: '+54' },
  { code: 'CL', label: 'Chile', dial: '+56' },
  { code: 'CO', label: 'Colombia', dial: '+57' },
  { code: 'PE', label: 'Peru', dial: '+51' },
];

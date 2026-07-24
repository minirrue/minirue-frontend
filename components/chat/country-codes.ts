export interface CountryCode { code: string; label: string; dial: string }

export const COUNTRY_CODES: CountryCode[] = [
  { code: 'EG', label: 'Egypt', dial: '+20' },
  { code: 'SA', label: 'Saudi Arabia', dial: '+966' },
  { code: 'AE', label: 'United Arab Emirates', dial: '+971' },
  { code: 'US', label: 'United States', dial: '+1' },
  { code: 'GB', label: 'United Kingdom', dial: '+44' },
  { code: 'FR', label: 'France', dial: '+33' },
];

export const DEFAULT_DIAL = '+20';

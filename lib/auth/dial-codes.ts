/**
 * Country dial codes for the signup phone field.
 *
 * Deliberately not the full ISO 3166 list: this is a select a shopper reads,
 * and 250 entries make it unusable. Egypt is first because it is the home
 * market, then the rest of the shipping region and the countries the customer
 * base actually comes from, alphabetically.
 */
export interface DialCode {
  /** ISO 3166-1 alpha-2 — also what the address book stores as countryCode. */
  code: string;
  name: string;
  dial: string;
}

export const DIAL_CODES: DialCode[] = [
  { code: 'EG', name: 'Egypt', dial: '+20' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { code: 'BH', name: 'Bahrain', dial: '+973' },
  { code: 'DZ', name: 'Algeria', dial: '+213' },
  { code: 'IQ', name: 'Iraq', dial: '+964' },
  { code: 'JO', name: 'Jordan', dial: '+962' },
  { code: 'KW', name: 'Kuwait', dial: '+965' },
  { code: 'LB', name: 'Lebanon', dial: '+961' },
  { code: 'LY', name: 'Libya', dial: '+218' },
  { code: 'MA', name: 'Morocco', dial: '+212' },
  { code: 'OM', name: 'Oman', dial: '+968' },
  { code: 'PS', name: 'Palestine', dial: '+970' },
  { code: 'QA', name: 'Qatar', dial: '+974' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { code: 'SD', name: 'Sudan', dial: '+249' },
  { code: 'SY', name: 'Syria', dial: '+963' },
  { code: 'TN', name: 'Tunisia', dial: '+216' },
  { code: 'TR', name: 'Türkiye', dial: '+90' },
  { code: 'YE', name: 'Yemen', dial: '+967' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'AT', name: 'Austria', dial: '+43' },
  { code: 'BE', name: 'Belgium', dial: '+32' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'CN', name: 'China', dial: '+86' },
  { code: 'DK', name: 'Denmark', dial: '+45' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'GR', name: 'Greece', dial: '+30' },
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'ID', name: 'Indonesia', dial: '+62' },
  { code: 'IE', name: 'Ireland', dial: '+353' },
  { code: 'IT', name: 'Italy', dial: '+39' },
  { code: 'JP', name: 'Japan', dial: '+81' },
  { code: 'KE', name: 'Kenya', dial: '+254' },
  { code: 'MY', name: 'Malaysia', dial: '+60' },
  { code: 'NL', name: 'Netherlands', dial: '+31' },
  { code: 'NG', name: 'Nigeria', dial: '+234' },
  { code: 'NO', name: 'Norway', dial: '+47' },
  { code: 'PK', name: 'Pakistan', dial: '+92' },
  { code: 'PH', name: 'Philippines', dial: '+63' },
  { code: 'PL', name: 'Poland', dial: '+48' },
  { code: 'PT', name: 'Portugal', dial: '+351' },
  { code: 'RO', name: 'Romania', dial: '+40' },
  { code: 'RU', name: 'Russia', dial: '+7' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'ZA', name: 'South Africa', dial: '+27' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'SE', name: 'Sweden', dial: '+46' },
  { code: 'CH', name: 'Switzerland', dial: '+41' },
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'US', name: 'United States', dial: '+1' },
];

export const DEFAULT_DIAL_CODE = '+20';

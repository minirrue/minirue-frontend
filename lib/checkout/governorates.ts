/**
 * THE closed list of Egyptian governorates (frontend#158, backend#186).
 *
 * A byte-for-byte mirror of the backend's `src/common/geo/governorates.ts` —
 * same 27 keys, same `{ en, ar }` labels, same normalisation rules. The two
 * are pinned together by `__tests__/checkout/governorates.test.ts`, which
 * compares `GOVERNORATES` against `lib/checkout/fixtures/governorates.fixture.json`,
 * a committed copy of the backend's own fixture export. If the backend adds
 * or renames a governorate, that test goes red until this file is updated to
 * match — not the other way around; this file is never the source of truth.
 *
 * Egypt checkout no longer accepts free text for `governorate`: every address
 * form (signed-in address book, guest checkout) uses a select built from this
 * list. `resolveGovernorateKey` maps legacy free text — including on an
 * existing saved address — onto one of these keys so nothing already on file
 * is silently dropped; when it cannot, the caller must force the shopper
 * through the select before continuing.
 */

export const GOVERNORATE_KEYS = [
  'ALEXANDRIA',
  'ASWAN',
  'ASYUT',
  'BEHEIRA',
  'BENI_SUEF',
  'CAIRO',
  'DAKAHLIA',
  'DAMIETTA',
  'FAIYUM',
  'GHARBIA',
  'GIZA',
  'ISMAILIA',
  'KAFR_EL_SHEIKH',
  'LUXOR',
  'MATROUH',
  'MINYA',
  'MONUFIA',
  'NEW_VALLEY',
  'NORTH_SINAI',
  'PORT_SAID',
  'QALYUBIA',
  'QENA',
  'RED_SEA',
  'SHARQIA',
  'SOHAG',
  'SOUTH_SINAI',
  'SUEZ',
] as const;

export type GovernorateKey = (typeof GOVERNORATE_KEYS)[number];

export interface GovernorateEntry {
  key: GovernorateKey;
  en: string;
  ar: string;
}

export const GOVERNORATES: readonly GovernorateEntry[] = [
  { key: 'ALEXANDRIA', en: 'Alexandria', ar: 'الإسكندرية' },
  { key: 'ASWAN', en: 'Aswan', ar: 'أسوان' },
  { key: 'ASYUT', en: 'Asyut', ar: 'أسيوط' },
  { key: 'BEHEIRA', en: 'Beheira', ar: 'البحيرة' },
  { key: 'BENI_SUEF', en: 'Beni Suef', ar: 'بني سويف' },
  { key: 'CAIRO', en: 'Cairo', ar: 'القاهرة' },
  { key: 'DAKAHLIA', en: 'Dakahlia', ar: 'الدقهلية' },
  { key: 'DAMIETTA', en: 'Damietta', ar: 'دمياط' },
  { key: 'FAIYUM', en: 'Faiyum', ar: 'الفيوم' },
  { key: 'GHARBIA', en: 'Gharbia', ar: 'الغربية' },
  { key: 'GIZA', en: 'Giza', ar: 'الجيزة' },
  { key: 'ISMAILIA', en: 'Ismailia', ar: 'الإسماعيلية' },
  { key: 'KAFR_EL_SHEIKH', en: 'Kafr El Sheikh', ar: 'كفر الشيخ' },
  { key: 'LUXOR', en: 'Luxor', ar: 'الأقصر' },
  { key: 'MATROUH', en: 'Matrouh', ar: 'مطروح' },
  { key: 'MINYA', en: 'Minya', ar: 'المنيا' },
  { key: 'MONUFIA', en: 'Monufia', ar: 'المنوفية' },
  { key: 'NEW_VALLEY', en: 'New Valley', ar: 'الوادي الجديد' },
  { key: 'NORTH_SINAI', en: 'North Sinai', ar: 'شمال سيناء' },
  { key: 'PORT_SAID', en: 'Port Said', ar: 'بورسعيد' },
  { key: 'QALYUBIA', en: 'Qalyubia', ar: 'القليوبية' },
  { key: 'QENA', en: 'Qena', ar: 'قنا' },
  { key: 'RED_SEA', en: 'Red Sea', ar: 'البحر الأحمر' },
  { key: 'SHARQIA', en: 'Sharqia', ar: 'الشرقية' },
  { key: 'SOHAG', en: 'Sohag', ar: 'سوهاج' },
  { key: 'SOUTH_SINAI', en: 'South Sinai', ar: 'جنوب سيناء' },
  { key: 'SUEZ', en: 'Suez', ar: 'السويس' },
];

const KEY_SET: ReadonlySet<string> = new Set(GOVERNORATE_KEYS);

export function isGovernorateKey(value: unknown): value is GovernorateKey {
  return typeof value === 'string' && KEY_SET.has(value);
}

/** Tatweel and the Arabic harakat. Decorative; never identity. */
const ARABIC_MARKS = /[ـً-ٰٟ]/g;
/**
 * Everything that is neither a letter, a digit, nor a space. `new RegExp`
 * rather than a literal for the same reason as `governorate-rates.ts`:
 * tsconfig targets ES2017 and `\p{…}` in a literal is rejected there.
 */
const NOT_IDENTITY = new RegExp('[^\\p{L}\\p{N} ]+', 'gu');
/** "Cairo Governorate", "Cairo gov." — the suffix carries no identity. */
const EN_SUFFIX = /\s+(governorate|governate|gov)$/;
/** The Arabic equivalent, which leads rather than trails. */
const AR_PREFIX = /^(محافظة|محافظه)\s+/;

/**
 * The free text reduced to something two spellings of one place share. A
 * deliberate copy of the backend's `normaliseGovernorateText` — same rules,
 * same order of operations — kept here rather than imported because this
 * package cannot depend on the backend at build time.
 */
export function normaliseGovernorateText(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let s = value.normalize('NFKC').replace(ARABIC_MARKS, '').toLowerCase();

  s = s
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

  s = s.replace(NOT_IDENTITY, ' ').replace(/ +/g, ' ').trim();
  s = s.replace(AR_PREFIX, '').replace(EN_SUFFIX, '').trim();

  return s.length > 0 ? s : null;
}

const LOOKUP: ReadonlyMap<string, GovernorateKey> = new Map(
  GOVERNORATES.flatMap((g) => {
    const pairs: Array<[string, GovernorateKey]> = [];
    const keyNorm = normaliseGovernorateText(g.key.replace(/_/g, ' '));
    const enNorm = normaliseGovernorateText(g.en);
    const arNorm = normaliseGovernorateText(g.ar);
    if (keyNorm) pairs.push([keyNorm, g.key]);
    if (enNorm) pairs.push([enNorm, g.key]);
    if (arNorm) pairs.push([arNorm, g.key]);
    return pairs;
  }),
);

/**
 * Maps free text — including a bare `GovernorateKey` string — onto one of the
 * 27 closed keys, or `null` when nothing matches. Used both to migrate legacy
 * saved addresses at read time and to pre-select the closed-list select from
 * whatever an existing address still carries. `null` means the shopper must
 * pick from the select before continuing — never silently defaulted.
 */
export function resolveGovernorateKey(value: unknown): GovernorateKey | null {
  if (isGovernorateKey(value)) return value;
  const needle = normaliseGovernorateText(value);
  if (needle === null) return null;
  return LOOKUP.get(needle) ?? null;
}

export function governorateLabel(key: GovernorateKey, locale: 'en' | 'ar' = 'en'): string {
  const entry = GOVERNORATES.find((g) => g.key === key);
  if (!entry) return key;
  return locale === 'ar' ? entry.ar : entry.en;
}

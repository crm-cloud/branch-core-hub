/**
 * Phone normalization helpers used by the chat / Contact Book identity resolver.
 * Mirrors the database-side `normalize_phone_in()` function so client lookups
 * always match server-stored values.
 */

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  const stripped = String(input).replace(/[^\d+]/g, '');
  if (!stripped) return '';
  if (stripped.startsWith('+')) return stripped;
  // 10-digit Indian mobile starting 6/7/8/9 → +91
  if (/^[6-9]\d{9}$/.test(stripped)) return `+91${stripped}`;
  // 12-digit starting 91 → +91...
  if (stripped.length === 12 && stripped.startsWith('91')) return `+${stripped}`;
  return `+${stripped}`;
}

/** Build the set of phone variants we should search by in the database. */
export function phoneVariants(input: string | null | undefined): string[] {
  if (!input) return [];
  const n = normalizePhone(input);
  const noPlus = n.replace(/^\+/, '');
  const last10 = noPlus.slice(-10);
  return Array.from(new Set([n, noPlus, `+${noPlus}`, last10].filter(Boolean)));
}

export function formatPhoneDisplay(input: string | null | undefined): string {
  const n = normalizePhone(input);
  if (!n) return '';
  // +91 98765 43210
  if (n.startsWith('+91') && n.length === 13) {
    return `+91 ${n.slice(3, 8)} ${n.slice(8)}`;
  }
  return n;
}

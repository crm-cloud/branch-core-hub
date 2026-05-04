// Canonical phone normalization for edge functions.
// Mirrors src/lib/contacts/phone.ts so server lookups always match
// whatever variant the UI / DB triggers stored.

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  const stripped = String(input).replace(/[^\d+]/g, "");
  if (!stripped) return "";
  if (stripped.startsWith("+")) return stripped;
  if (/^[6-9]\d{9}$/.test(stripped)) return `+91${stripped}`;
  if (stripped.length === 12 && stripped.startsWith("91")) return `+${stripped}`;
  return `+${stripped}`;
}

/** All variants we should match against `profiles.phone` / `leads.phone` /
 *  `contacts.phone` for a given inbound number. Includes the bare 10-digit
 *  form (which is what users frequently store), the +91-prefixed form, the
 *  91-prefixed (no +) form, and the original raw stripped form. */
export function phoneVariants(input: string | null | undefined): string[] {
  if (!input) return [];
  const n = normalizePhone(input);
  if (!n) return [];
  const noPlus = n.replace(/^\+/, "");
  const last10 = noPlus.slice(-10);
  const raw = String(input).replace(/[\s\-]/g, "");
  return Array.from(
    new Set([n, noPlus, `+${noPlus}`, last10, raw].filter(Boolean)),
  );
}

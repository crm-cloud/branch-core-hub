// Shared HTML escape utility for safely interpolating user-supplied
// data into print/export HTML strings (XSS prevention).
//
// Use whenever a value from the database (member name, email, notes,
// product description, etc.) is concatenated into an HTML template
// passed to printWindow.document.write or innerHTML.

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Convenience alias for short-form usage in template literals: ${e(x)}
export const e = escapeHtml;

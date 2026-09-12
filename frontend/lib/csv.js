// Spreadsheet apps execute cells that start with = + - @ (or tab/CR). Prefix
// those with an apostrophe so exported text always stays text, and escape
// embedded quotes so the row stays well-formed.
export function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

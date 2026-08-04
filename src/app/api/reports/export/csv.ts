export function neutralizeSpreadsheetFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCsvCell(value: unknown): string {
  return neutralizeSpreadsheetFormula(String(value ?? ''));
}

export function escapeCsvCell(value: unknown): string {
  return `"${toCsvCell(value).replace(/"/g, '""')}"`;
}

export function parseStoredBoolean(
  value: unknown,
  fallback: boolean,
): boolean {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  if (value === 1) return true;
  if (value === 0) return false;

  return fallback;
}

export function parseFiniteNumber(
  value: unknown,
  fallback: number,
): number {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parsePositiveNumber(
  value: unknown,
): number | null {
  const parsed = parseFiniteNumber(value, Number.NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

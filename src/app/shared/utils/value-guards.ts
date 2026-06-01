export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

export function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }
  return '';
}

export function hasNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.some((item) => isNonEmptyString(item));
}

export function hasCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2;
}

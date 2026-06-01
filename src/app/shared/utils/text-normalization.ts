export function normalizeText(value?: string): string {
  return (value || '').toString().trim();
}

export function normalizeToSlug(value?: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

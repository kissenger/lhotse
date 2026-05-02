function stripTrailingWrapperChars(value: string): string {
  let result = value;

  const hasMoreClosersThanOpeners = (openChar: string, closeChar: string): boolean => {
    const openCount = [...result].filter((char) => char === openChar).length;
    const closeCount = [...result].filter((char) => char === closeChar).length;
    return closeCount > openCount;
  };

  while (result) {
    const lastChar = result.at(-1);
    if (!lastChar) break;

    if (/[.,;:!?]/.test(lastChar)) {
      result = result.slice(0, -1);
      continue;
    }

    if (/["'>]/.test(lastChar)) {
      result = result.slice(0, -1);
      continue;
    }

    if (lastChar === ')' && hasMoreClosersThanOpeners('(', ')')) {
      result = result.slice(0, -1);
      continue;
    }

    if (lastChar === ']' && hasMoreClosersThanOpeners('[', ']')) {
      result = result.slice(0, -1);
      continue;
    }

    if (lastChar === '}' && hasMoreClosersThanOpeners('{', '}')) {
      result = result.slice(0, -1);
      continue;
    }

    break;
  }

  return result;
}

export function normaliseResearchLink(raw: unknown): string | null {
  if (raw == null) return null;

  const value = String(raw).trim();
  if (!value) return null;

  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;

  const cleaned = stripTrailingWrapperChars(match[0].replace(/^[<(\[{"']+/, ''));
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normaliseResearchLinks(raw: unknown): string[] {
  if (!raw) return [];

  let values = raw;
  if (typeof values === 'string') {
    try {
      values = JSON.parse(values);
    } catch {
      values = [values];
    }
  }

  if (!Array.isArray(values)) return [];

  return values
    .map((value) => normaliseResearchLink(value))
    .filter((value): value is string => value !== null);
}
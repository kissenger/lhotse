export function errorMessage(error: unknown, fallback: string): string {
  const message = (error as any)?.error?.message;
  if (typeof message === 'string' && message.trim() !== '') {
    return message;
  }
  return fallback;
}

const LOCAL_DEFAULT_BASE_URL = 'http://localhost:4000';

function sanitizeBaseUrl(url) {
  return url.replace(/\/$/, '');
}

export function resolveBaseUrl(options = {}) {
  const {
    cliArg,
    envKeys = ['TEST_APP_BASE_URL'],
    localDefault = LOCAL_DEFAULT_BASE_URL,
  } = options;

  if (typeof cliArg === 'string' && cliArg.trim()) {
    return sanitizeBaseUrl(cliArg.trim());
  }

  for (const key of envKeys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return sanitizeBaseUrl(value.trim());
    }
  }

  return sanitizeBaseUrl(localDefault);
}

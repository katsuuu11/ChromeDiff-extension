export function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function normalizeBaseUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('http/https のURLのみ使えます。');
  }
  url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  url.search = '';
  url.hash = '';
  return url;
}

export function safeErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

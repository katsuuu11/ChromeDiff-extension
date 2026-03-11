import { SIDE } from '../shared/constants.js';
import { normalizeBaseUrl } from '../shared/utils.js';

export function normalizePath(path = '/') {
  if (!path) return '/';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    const parsed = new URL(path);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function buildPairedUrls(stagingBaseUrl, productionBaseUrl, path = '/') {
  const stgBase = normalizeBaseUrl(stagingBaseUrl);
  const prodBase = normalizeBaseUrl(productionBaseUrl);
  const relative = normalizePath(path);
  return {
    leftUrl: new URL(relative, stgBase).toString(),
    rightUrl: new URL(relative, prodBase).toString(),
  };
}

export function extractRelativePath(urlString, session) {
  const url = new URL(urlString);
  const stg = normalizeBaseUrl(session.stagingBaseUrl);
  const prod = normalizeBaseUrl(session.productionBaseUrl);
  const candidates = [stg, prod];

  for (const base of candidates) {
    if (url.origin !== base.origin) continue;
    const basePath = base.pathname.endsWith('/') ? base.pathname.slice(0, -1) : base.pathname;
    if (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`)) {
      const suffix = url.pathname.slice(basePath.length) || '/';
      return `${suffix}${url.search}${url.hash}`;
    }
  }
  return null;
}

export function mapUrlToOtherSide(sourceSide, sourceUrl, session) {
  const relative = extractRelativePath(sourceUrl, session);
  if (!relative) return null;
  const targetBase = sourceSide === SIDE.LEFT ? session.productionBaseUrl : session.stagingBaseUrl;
  return new URL(normalizePath(relative), normalizeBaseUrl(targetBase)).toString();
}

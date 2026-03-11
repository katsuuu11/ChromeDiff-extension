import { MAX_RECENT_PAIRS, STORAGE_KEYS } from './constants.js';

export async function getSession() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
  return data[STORAGE_KEYS.SESSION] ?? null;
}

export async function setSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
}

export async function getPopupPrefs() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.POPUP_PREFS);
  const prefs = data[STORAGE_KEYS.POPUP_PREFS] ?? {};
  return {
    recentPairs: Array.isArray(prefs.recentPairs) ? prefs.recentPairs : [],
    mappingHints: Array.isArray(prefs.mappingHints) ? prefs.mappingHints : [],
  };
}

export async function setPopupPrefs(prefs) {
  await chrome.storage.local.set({ [STORAGE_KEYS.POPUP_PREFS]: prefs });
}

export async function recordRecentPair(stagingUrl, productionUrl) {
  const prefs = await getPopupPrefs();
  const now = new Date().toISOString();
  const stagingOrigin = new URL(stagingUrl).origin;
  const productionOrigin = new URL(productionUrl).origin;

  const recentPairs = [
    { stagingUrl, productionUrl, usedAt: now },
    ...prefs.recentPairs.filter((pair) => !(pair.stagingUrl === stagingUrl && pair.productionUrl === productionUrl)),
  ].slice(0, MAX_RECENT_PAIRS);

  const mappingHints = [
    { stagingOrigin, productionOrigin, lastUsedAt: now },
    ...prefs.mappingHints.filter(
      (hint) => !(hint.stagingOrigin === stagingOrigin && hint.productionOrigin === productionOrigin),
    ),
  ].slice(0, MAX_RECENT_PAIRS);

  await setPopupPrefs({ recentPairs, mappingHints });
}

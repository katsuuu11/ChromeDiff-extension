import { STORAGE_KEYS } from './constants.js';

const URL_ASSIST_DEFAULTS = {
  recentPairs: [],
  mappingHints: [],
};

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

export async function getUrlAssistState() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.URL_ASSIST);
  return { ...URL_ASSIST_DEFAULTS, ...(data[STORAGE_KEYS.URL_ASSIST] ?? {}) };
}

export async function setUrlAssistState(state) {
  const nextState = { ...URL_ASSIST_DEFAULTS, ...state };
  await chrome.storage.local.set({ [STORAGE_KEYS.URL_ASSIST]: nextState });
}

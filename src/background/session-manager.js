import { MESSAGE_TYPES, SIDE, SUPPRESSION_MS } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import { getSession, setSession, clearSession, getUrlAssistState, setUrlAssistState } from '../shared/storage.js';
import { generateSessionId, normalizeBaseUrl } from '../shared/utils.js';
import { buildPairedUrls, mapUrlToOtherSide } from './url-mapper.js';
import { openPairedWindows, realignWindows } from './window-manager.js';

const navSuppressByTabId = new Map();
const MAX_RECENT_PAIRS = 6;
const MAX_MAPPING_HINTS = 12;

async function injectCompareAgent(tabId, side) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      'src/content/page-state.js',
      'src/content/scroll-sync.js',
      'src/content/nav-sync.js',
      'src/content/control-bar.js',
      'src/content/compare-agent.js',
    ],
  });
  await chrome.tabs.sendMessage(tabId, { type: 'INIT_COMPARE_AGENT', side });
}

function normalizeHint(baseUrl) {
  return normalizeBaseUrl(baseUrl).toString();
}

async function rememberUrlPair(stagingUrl, productionUrl) {
  const assist = await getUrlAssistState();
  const now = new Date().toISOString();

  const recentPairs = [
    { stagingUrl, productionUrl, updatedAt: now },
    ...assist.recentPairs.filter((pair) => pair.stagingUrl !== stagingUrl || pair.productionUrl !== productionUrl),
  ].slice(0, MAX_RECENT_PAIRS);

  const hint = {
    stagingBaseUrl: normalizeHint(stagingUrl),
    productionBaseUrl: normalizeHint(productionUrl),
    updatedAt: now,
  };

  const mappingHints = [
    hint,
    ...assist.mappingHints.filter(
      (item) => item.stagingBaseUrl !== hint.stagingBaseUrl || item.productionBaseUrl !== hint.productionBaseUrl,
    ),
  ].slice(0, MAX_MAPPING_HINTS);

  await setUrlAssistState({ recentPairs, mappingHints });
}

export async function startSession(payload) {
  const { stagingUrl, productionUrl } = payload;
  const { leftWindow, rightWindow } = await openPairedWindows(stagingUrl, productionUrl);
  const leftTabId = leftWindow.tabs?.[0]?.id;
  const rightTabId = rightWindow.tabs?.[0]?.id;

  const session = {
    sessionId: generateSessionId(),
    createdAt: new Date().toISOString(),
    stagingBaseUrl: normalizeHint(stagingUrl),
    productionBaseUrl: normalizeHint(productionUrl),
    leftWindowId: leftWindow.id,
    rightWindowId: rightWindow.id,
    leftTabId,
    rightTabId,
    syncEnabled: true,
    urlSyncEnabled: true,
    scrollSyncEnabled: true,
    degraded: false,
    lastKnownLeftUrl: stagingUrl,
    lastKnownRightUrl: productionUrl,
  };

  await setSession(session);
  await rememberUrlPair(stagingUrl, productionUrl);
  if (leftTabId) await injectCompareAgent(leftTabId, SIDE.LEFT);
  if (rightTabId) await injectCompareAgent(rightTabId, SIDE.RIGHT);
  return session;
}

export async function getSessionState() {
  return getSession();
}

export async function endSession() {
  const session = await getSession();
  if (session?.leftWindowId) await chrome.windows.remove(session.leftWindowId).catch(() => undefined);
  if (session?.rightWindowId) await chrome.windows.remove(session.rightWindowId).catch(() => undefined);
  navSuppressByTabId.clear();
  await clearSession();
  return { ok: true };
}

export async function updateToggles({ scrollSyncEnabled, urlSyncEnabled, syncEnabled }) {
  const session = await getSession();
  if (!session) return null;
  if (typeof scrollSyncEnabled === 'boolean') session.scrollSyncEnabled = scrollSyncEnabled;
  if (typeof urlSyncEnabled === 'boolean') session.urlSyncEnabled = urlSyncEnabled;
  if (typeof syncEnabled === 'boolean') session.syncEnabled = syncEnabled;
  await setSession(session);
  await broadcastState(session);
  return session;
}

export async function resumeSession() {
  const session = await recoverSession();
  if (!session) return null;
  if (session.leftTabId) await injectCompareAgent(session.leftTabId, SIDE.LEFT).catch(() => undefined);
  if (session.rightTabId) await injectCompareAgent(session.rightTabId, SIDE.RIGHT).catch(() => undefined);
  await broadcastState(session);
  return session;
}

export async function recoverSession() {
  const session = await getSession();
  if (!session) return null;

  const leftWindow = session.leftWindowId ? await chrome.windows.get(session.leftWindowId).catch(() => null) : null;
  const rightWindow = session.rightWindowId ? await chrome.windows.get(session.rightWindowId).catch(() => null) : null;
  session.degraded = !(leftWindow && rightWindow);

  const leftTab = session.leftTabId ? await chrome.tabs.get(session.leftTabId).catch(() => null) : null;
  const rightTab = session.rightTabId ? await chrome.tabs.get(session.rightTabId).catch(() => null) : null;
  if (!leftTab) session.leftTabId = null;
  if (!rightTab) session.rightTabId = null;

  await setSession(session);
  return session;
}

export async function handlePageScroll({ tabId, ratio }) {
  const session = await getSession();
  if (!session || !session.syncEnabled || !session.scrollSyncEnabled) return;
  const targetTabId = tabId === session.leftTabId ? session.rightTabId : session.leftTabId;
  if (!targetTabId) return;

  await chrome.tabs.sendMessage(targetTabId, {
    type: MESSAGE_TYPES.PAGE_SCROLL,
    ratio,
  }).catch(() => undefined);
}

export async function handlePageNavigated({ tabId, url }) {
  const session = await getSession();
  if (!session || !session.syncEnabled || !session.urlSyncEnabled) return;

  const sourceSide = tabId === session.leftTabId ? SIDE.LEFT : tabId === session.rightTabId ? SIDE.RIGHT : null;
  if (!sourceSide) return;

  if (sourceSide === SIDE.LEFT) session.lastKnownLeftUrl = url;
  if (sourceSide === SIDE.RIGHT) session.lastKnownRightUrl = url;

  const suppressedUntil = navSuppressByTabId.get(tabId);
  if (suppressedUntil && suppressedUntil > Date.now()) {
    await setSession(session);
    return;
  }

  const mapped = mapUrlToOtherSide(sourceSide, url, session);
  const targetTabId = sourceSide === SIDE.LEFT ? session.rightTabId : session.leftTabId;
  if (!mapped || !targetTabId) {
    await setSession(session);
    return;
  }

  navSuppressByTabId.set(targetTabId, Date.now() + SUPPRESSION_MS);
  await chrome.tabs.update(targetTabId, { url: mapped }).catch(() => undefined);
  if (sourceSide === SIDE.LEFT) session.lastKnownRightUrl = mapped;
  else session.lastKnownLeftUrl = mapped;

  await setSession(session);
  await broadcastState(session);
}

export async function handleReAlign({ tabId, ratio }) {
  const session = await getSession();
  if (!session) return;
  const targetTabId = tabId === session.leftTabId ? session.rightTabId : session.leftTabId;
  if (!targetTabId) return;
  await chrome.tabs.sendMessage(targetTabId, { type: MESSAGE_TYPES.PAGE_SCROLL, ratio, force: true }).catch(() => undefined);
}

export async function reopenMissingSide() {
  const session = await getSession();
  if (!session) return null;

  const leftExists = session.leftWindowId ? await chrome.windows.get(session.leftWindowId).then(() => true).catch(() => false) : false;
  const rightExists = session.rightWindowId ? await chrome.windows.get(session.rightWindowId).then(() => true).catch(() => false) : false;

  const relativeFromLeft = session.lastKnownLeftUrl || session.lastKnownRightUrl || '/';
  const { leftUrl, rightUrl } = buildPairedUrls(session.stagingBaseUrl, session.productionBaseUrl, relativeFromLeft);

  if (!leftExists) {
    const win = await chrome.windows.create({ url: leftUrl, type: 'normal' });
    session.leftWindowId = win.id;
    session.leftTabId = win.tabs?.[0]?.id ?? null;
    if (session.leftTabId) await injectCompareAgent(session.leftTabId, SIDE.LEFT);
  }
  if (!rightExists) {
    const win = await chrome.windows.create({ url: rightUrl, type: 'normal' });
    session.rightWindowId = win.id;
    session.rightTabId = win.tabs?.[0]?.id ?? null;
    if (session.rightTabId) await injectCompareAgent(session.rightTabId, SIDE.RIGHT);
  }

  session.degraded = false;
  await setSession(session);
  await realignWindows(session);
  await broadcastState(session);
  return session;
}

export async function notifyWindowClosed(windowId) {
  const session = await getSession();
  if (!session) return;
  if (windowId !== session.leftWindowId && windowId !== session.rightWindowId) return;

  if (windowId === session.leftWindowId) {
    session.leftWindowId = null;
    session.leftTabId = null;
  }
  if (windowId === session.rightWindowId) {
    session.rightWindowId = null;
    session.rightTabId = null;
  }
  session.degraded = true;
  await setSession(session);
  await broadcastState(session);
}

export async function broadcastState(sessionArg) {
  const session = sessionArg ?? (await getSession());
  if (!session) return;

  const payload = { type: MESSAGE_TYPES.SESSION_STATE_UPDATED, session };
  const tabs = [session.leftTabId, session.rightTabId].filter(Boolean);
  await Promise.all(tabs.map((tabId) => chrome.tabs.sendMessage(tabId, payload).catch(() => undefined)));
}

export function registerTabUpdateHooks() {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') return;
    const session = await getSession();
    if (!session) return;
    const side = tabId === session.leftTabId ? SIDE.LEFT : tabId === session.rightTabId ? SIDE.RIGHT : null;
    if (!side) return;
    await injectCompareAgent(tabId, side).catch((error) => logger.warn('inject failed', error));
  });
}

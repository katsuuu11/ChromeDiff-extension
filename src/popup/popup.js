import { MESSAGE_TYPES } from '../shared/constants.js';
import { getPopupPrefs } from '../shared/storage.js';
import { safeErrorMessage } from '../shared/utils.js';

const el = {
  newSessionSection: document.getElementById('newSessionSection'),
  activeSessionSection: document.getElementById('activeSessionSection'),
  stagingUrl: document.getElementById('stagingUrl'),
  productionUrl: document.getElementById('productionUrl'),
  startBtn: document.getElementById('startBtn'),
  useCurrentAsStgBtn: document.getElementById('useCurrentAsStgBtn'),
  useCurrentAsProdBtn: document.getElementById('useCurrentAsProdBtn'),
  generateStgBtn: document.getElementById('generateStgBtn'),
  generateProdBtn: document.getElementById('generateProdBtn'),
  recentPairs: document.getElementById('recentPairs'),
  resumeBtn: document.getElementById('resumeBtn'),
  restartBtn: document.getElementById('restartBtn'),
  reopenBtn: document.getElementById('reopenBtn'),
  endBtn: document.getElementById('endBtn'),
  scrollSyncToggle: document.getElementById('scrollSyncToggle'),
  urlSyncToggle: document.getElementById('urlSyncToggle'),
  sessionMeta: document.getElementById('sessionMeta'),
  message: document.getElementById('message'),
};

let popupPrefs = { recentPairs: [], mappingHints: [] };

function setMessage(msg, isError = false) {
  el.message.textContent = msg;
  el.message.style.color = isError ? '#991b1b' : '#334155';
}

function parseAbsoluteUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are supported.');
  }
  return url;
}

function validateInput(staging, production) {
  if (!staging || !production) throw new Error('Staging URL and production URL are required.');
  const s = parseAbsoluteUrl(staging);
  const p = parseAbsoluteUrl(production);
  if (s.href === p.href) {
    setMessage('Warning: staging and production URLs are identical.');
  }
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function getCurrentTabUrl() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (!url) throw new Error('No active tab URL found.');
  parseAbsoluteUrl(url);
  return url;
}

function renderRecentPairs() {
  el.recentPairs.textContent = '';
  if (!popupPrefs.recentPairs.length) {
    el.recentPairs.textContent = 'No recent pairs yet.';
    return;
  }

  for (const pair of popupPrefs.recentPairs) {
    const btn = document.createElement('button');
    btn.className = 'suggestion';
    btn.innerHTML = `STG: ${pair.stagingUrl}<small>PROD: ${pair.productionUrl}</small>`;
    btn.addEventListener('click', () => {
      el.stagingUrl.value = pair.stagingUrl;
      el.productionUrl.value = pair.productionUrl;
      setMessage('Filled from recent pair.');
    });
    el.recentPairs.appendChild(btn);
  }
}

function getHintedTargetOrigin(sourceUrl, targetSide) {
  const sourceOrigin = sourceUrl.origin;
  const targetFieldValue = targetSide === 'stg' ? el.stagingUrl.value.trim() : el.productionUrl.value.trim();
  if (targetFieldValue) {
    try {
      return parseAbsoluteUrl(targetFieldValue).origin;
    } catch (_error) {
      // ignore and fallback to mapping hints
    }
  }

  if (targetSide === 'prod') {
    const hint = popupPrefs.mappingHints.find((item) => item.stagingOrigin === sourceOrigin);
    return hint?.productionOrigin ?? null;
  }
  const hint = popupPrefs.mappingHints.find((item) => item.productionOrigin === sourceOrigin);
  return hint?.stagingOrigin ?? null;
}

function generatePairedUrl(fromSide, toSide) {
  const sourceValue = fromSide === 'stg' ? el.stagingUrl.value.trim() : el.productionUrl.value.trim();
  if (!sourceValue) throw new Error('Enter the source URL first.');

  const source = parseAbsoluteUrl(sourceValue);
  const targetOrigin = getHintedTargetOrigin(source, toSide);
  if (!targetOrigin) {
    throw new Error('No mapping hint found. Fill the other URL once or use a recent pair first.');
  }

  const generated = `${targetOrigin}${source.pathname}${source.search}${source.hash}`;
  if (toSide === 'stg') el.stagingUrl.value = generated;
  else el.productionUrl.value = generated;
  setMessage('Generated paired URL.');
}

async function refreshUI() {
  popupPrefs = await getPopupPrefs();
  renderRecentPairs();

  const response = await sendMessage({ type: MESSAGE_TYPES.GET_SESSION_STATE });
  const session = response?.session;
  const hasSession = !!session;

  el.newSessionSection.classList.toggle('hidden', hasSession);
  el.activeSessionSection.classList.toggle('hidden', !hasSession);

  if (session) {
    el.sessionMeta.textContent = `Session ${session.sessionId} (${session.degraded ? 'degraded' : 'active'})`;
    el.scrollSyncToggle.checked = !!session.scrollSyncEnabled;
    el.urlSyncToggle.checked = !!session.urlSyncEnabled;
  }
}

el.useCurrentAsStgBtn.addEventListener('click', async () => {
  try {
    el.stagingUrl.value = await getCurrentTabUrl();
    setMessage('Current tab set as STG URL.');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.useCurrentAsProdBtn.addEventListener('click', async () => {
  try {
    el.productionUrl.value = await getCurrentTabUrl();
    setMessage('Current tab set as PROD URL.');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.generateProdBtn.addEventListener('click', () => {
  try {
    generatePairedUrl('stg', 'prod');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.generateStgBtn.addEventListener('click', () => {
  try {
    generatePairedUrl('prod', 'stg');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.startBtn.addEventListener('click', async () => {
  try {
    const stagingUrl = el.stagingUrl.value.trim();
    const productionUrl = el.productionUrl.value.trim();
    validateInput(stagingUrl, productionUrl);
    const response = await sendMessage({
      type: MESSAGE_TYPES.START_SESSION,
      payload: { stagingUrl, productionUrl },
    });
    if (!response.ok) throw new Error(response.error);
    setMessage('Session started.');
    await refreshUI();
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.resumeBtn.addEventListener('click', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.RESUME_SESSION });
  setMessage(response.ok ? 'Session resumed.' : response.error, !response.ok);
  await refreshUI();
});

el.restartBtn.addEventListener('click', async () => {
  const existing = await sendMessage({ type: MESSAGE_TYPES.GET_SESSION_STATE });
  if (!existing.session) return;
  await sendMessage({ type: MESSAGE_TYPES.END_SESSION });
  const response = await sendMessage({
    type: MESSAGE_TYPES.START_SESSION,
    payload: {
      stagingUrl: existing.session.lastKnownLeftUrl || existing.session.stagingBaseUrl,
      productionUrl: existing.session.lastKnownRightUrl || existing.session.productionBaseUrl,
    },
  });
  setMessage(response.ok ? 'Session restarted.' : response.error, !response.ok);
  await refreshUI();
});

el.reopenBtn.addEventListener('click', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.REOPEN_MISSING_SIDE });
  setMessage(response.ok ? 'Missing side reopened (if needed).' : response.error, !response.ok);
  await refreshUI();
});

el.endBtn.addEventListener('click', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.END_SESSION });
  setMessage(response.ok ? 'Session ended.' : response.error, !response.ok);
  await refreshUI();
});

el.scrollSyncToggle.addEventListener('change', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.TOGGLE_SCROLL_SYNC, enabled: el.scrollSyncToggle.checked });
  setMessage(response.ok ? 'Scroll sync updated.' : response.error, !response.ok);
});

el.urlSyncToggle.addEventListener('change', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.TOGGLE_URL_SYNC, enabled: el.urlSyncToggle.checked });
  setMessage(response.ok ? 'URL sync updated.' : response.error, !response.ok);
});

refreshUI().catch((error) => setMessage(safeErrorMessage(error), true));

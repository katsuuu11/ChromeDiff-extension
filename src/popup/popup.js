import { MESSAGE_TYPES, SIDE, STORAGE_KEYS } from '../shared/constants.js';
import { mapUrlToOtherSide } from '../background/url-mapper.js';
import { safeErrorMessage } from '../shared/utils.js';

const el = {
  newSessionSection: document.getElementById('newSessionSection'),
  activeSessionSection: document.getElementById('activeSessionSection'),
  stagingUrl: document.getElementById('stagingUrl'),
  productionUrl: document.getElementById('productionUrl'),
  useCurrentAsStgBtn: document.getElementById('useCurrentAsStgBtn'),
  useCurrentAsProdBtn: document.getElementById('useCurrentAsProdBtn'),
  generateProdBtn: document.getElementById('generateProdBtn'),
  generateStgBtn: document.getElementById('generateStgBtn'),
  recentPairsSection: document.getElementById('recentPairsSection'),
  recentPairsList: document.getElementById('recentPairsList'),
  startBtn: document.getElementById('startBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  restartBtn: document.getElementById('restartBtn'),
  reopenBtn: document.getElementById('reopenBtn'),
  endBtn: document.getElementById('endBtn'),
  scrollSyncToggle: document.getElementById('scrollSyncToggle'),
  urlSyncToggle: document.getElementById('urlSyncToggle'),
  sessionMeta: document.getElementById('sessionMeta'),
  message: document.getElementById('message'),
};

function setMessage(msg, isError = false) {
  el.message.textContent = msg;
  el.message.style.color = isError ? '#991b1b' : '#334155';
}

function validateInput(staging, production) {
  if (!staging || !production) throw new Error('Staging and production URLs are required.');
  const s = new URL(staging);
  const p = new URL(production);
  if (!['http:', 'https:'].includes(s.protocol) || !['http:', 'https:'].includes(p.protocol)) {
    throw new Error('Only http/https URLs are supported');
  }
  if (s.toString() === p.toString()) setMessage('Warning: staging and production look identical.');
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) throw new Error('No active tab URL available.');
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    throw new Error('Current tab must be an http/https page.');
  }
  return tab.url;
}

function pickGeneratedUrl(sourceUrl, targetSide, assistState) {
  const hints = assistState.mappingHints ?? [];
  for (const hint of hints) {
    const fakeSession = {
      stagingBaseUrl: hint.stagingBaseUrl,
      productionBaseUrl: hint.productionBaseUrl,
    };
    const sourceSide = targetSide === 'production' ? SIDE.LEFT : SIDE.RIGHT;
    const mapped = mapUrlToOtherSide(sourceSide, sourceUrl, fakeSession);
    if (mapped) return mapped;
  }
  return null;
}

async function getAssistState() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.URL_ASSIST);
  return data[STORAGE_KEYS.URL_ASSIST] ?? { recentPairs: [], mappingHints: [] };
}

function renderRecentPairs(assistState) {
  const recentPairs = assistState.recentPairs ?? [];
  el.recentPairsList.innerHTML = '';
  el.recentPairsSection.classList.toggle('hidden', recentPairs.length === 0);

  for (const pair of recentPairs) {
    const button = document.createElement('button');
    button.className = 'subtle recentPair';
    button.type = 'button';
    button.title = `${pair.stagingUrl} ⇄ ${pair.productionUrl}`;
    button.textContent = `${pair.stagingUrl} ⇄ ${pair.productionUrl}`;
    button.addEventListener('click', () => {
      el.stagingUrl.value = pair.stagingUrl;
      el.productionUrl.value = pair.productionUrl;
      setMessage('Filled URLs from recent pair.');
    });
    el.recentPairsList.appendChild(button);
  }
}

async function refreshUI() {
  const [response, assistState] = await Promise.all([
    sendMessage({ type: MESSAGE_TYPES.GET_SESSION_STATE }),
    getAssistState(),
  ]);

  const session = response?.session;
  const hasSession = !!session;

  el.newSessionSection.classList.toggle('hidden', hasSession);
  el.activeSessionSection.classList.toggle('hidden', !hasSession);

  renderRecentPairs(assistState);

  if (session) {
    el.sessionMeta.textContent = `Session ${session.sessionId} (${session.degraded ? 'degraded' : 'active'})`;
    el.scrollSyncToggle.checked = !!session.scrollSyncEnabled;
    el.urlSyncToggle.checked = !!session.urlSyncEnabled;
  }
}

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

el.useCurrentAsStgBtn.addEventListener('click', async () => {
  try {
    el.stagingUrl.value = await getCurrentTabUrl();
    setMessage('Current tab copied to STG URL.');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.useCurrentAsProdBtn.addEventListener('click', async () => {
  try {
    el.productionUrl.value = await getCurrentTabUrl();
    setMessage('Current tab copied to PROD URL.');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.generateProdBtn.addEventListener('click', async () => {
  try {
    const source = el.stagingUrl.value.trim();
    if (!source) throw new Error('Enter a STG URL first.');
    const assistState = await getAssistState();
    const generated = pickGeneratedUrl(source, 'production', assistState);
    if (!generated) throw new Error('No mapping hint found to generate PROD URL.');
    el.productionUrl.value = generated;
    setMessage('Generated PROD URL from STG URL.');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.generateStgBtn.addEventListener('click', async () => {
  try {
    const source = el.productionUrl.value.trim();
    if (!source) throw new Error('Enter a PROD URL first.');
    const assistState = await getAssistState();
    const generated = pickGeneratedUrl(source, 'staging', assistState);
    if (!generated) throw new Error('No mapping hint found to generate STG URL.');
    el.stagingUrl.value = generated;
    setMessage('Generated STG URL from PROD URL.');
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

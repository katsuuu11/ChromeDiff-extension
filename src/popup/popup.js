import { MESSAGE_TYPES } from '../shared/constants.js';
import { normalizeBaseUrl, safeErrorMessage } from '../shared/utils.js';

const el = {
  newSessionSection: document.getElementById('newSessionSection'),
  activeSessionSection: document.getElementById('activeSessionSection'),
  stagingUrl: document.getElementById('stagingUrl'),
  productionUrl: document.getElementById('productionUrl'),
  initialPath: document.getElementById('initialPath'),
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
  const s = normalizeBaseUrl(staging);
  const p = normalizeBaseUrl(production);
  if (s.origin === p.origin && s.pathname === p.pathname) {
    setMessage('Warning: staging and production look identical.');
  }
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function refreshUI() {
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

el.startBtn.addEventListener('click', async () => {
  try {
    const stagingBaseUrl = el.stagingUrl.value.trim();
    const productionBaseUrl = el.productionUrl.value.trim();
    const initialPath = el.initialPath.value.trim() || '/';
    validateInput(stagingBaseUrl, productionBaseUrl);
    const response = await sendMessage({
      type: MESSAGE_TYPES.START_SESSION,
      payload: { stagingBaseUrl, productionBaseUrl, initialPath },
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
      stagingBaseUrl: existing.session.stagingBaseUrl,
      productionBaseUrl: existing.session.productionBaseUrl,
      initialPath: '/',
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

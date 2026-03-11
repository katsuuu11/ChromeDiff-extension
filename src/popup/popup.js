import { MESSAGE_TYPES } from '../shared/constants.js';
import { safeErrorMessage } from '../shared/utils.js';

const el = {
  newSessionSection: document.getElementById('newSessionSection'),
  activeSessionSection: document.getElementById('activeSessionSection'),
  stagingUrl: document.getElementById('stagingUrl'),
  productionUrl: document.getElementById('productionUrl'),
  useCurrentAsStgBtn: document.getElementById('useCurrentAsStgBtn'),
  useCurrentAsProdBtn: document.getElementById('useCurrentAsProdBtn'),
  startBtn: document.getElementById('startBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  restartBtn: document.getElementById('restartBtn'),
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
  if (!staging || !production) throw new Error('ステージングURLと本番URLを入れてください。');
  const s = new URL(staging);
  const p = new URL(production);
  if (!['http:', 'https:'].includes(s.protocol) || !['http:', 'https:'].includes(p.protocol)) {
    throw new Error('http/https のURLのみ使えます。');
  }
  if (s.toString() === p.toString()) setMessage('ステージングURLと本番URLが同じです。');
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) throw new Error('今のタブのURLを取得できませんでした。');
  if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
    throw new Error('今のタブは http/https ページで開いてください。');
  }
  return tab.url;
}

function describeSession(session) {
  if (!session) return '';
  if (session.degraded) return '片方の画面が閉じられました';
  if (!session.syncEnabled) return '同期停止中';
  return '比較中';
}

async function refreshUI() {
  const response = await sendMessage({ type: MESSAGE_TYPES.GET_SESSION_STATE });

  const session = response?.session;
  const hasSession = !!session;

  el.newSessionSection.classList.toggle('hidden', hasSession);
  el.activeSessionSection.classList.toggle('hidden', !hasSession);

  if (session) {
    el.sessionMeta.textContent = describeSession(session);
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
    setMessage('比較を開始しました。');
    await refreshUI();
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.useCurrentAsStgBtn.addEventListener('click', async () => {
  try {
    el.stagingUrl.value = await getCurrentTabUrl();
    setMessage('今のタブをステージングURLに入れました。');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.useCurrentAsProdBtn.addEventListener('click', async () => {
  try {
    el.productionUrl.value = await getCurrentTabUrl();
    setMessage('今のタブを本番URLに入れました。');
  } catch (error) {
    setMessage(safeErrorMessage(error), true);
  }
});

el.resumeBtn.addEventListener('click', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.RESUME_SESSION });
  setMessage(response.ok ? '再開しました。' : response.error, !response.ok);
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
  setMessage(response.ok ? 'やり直しました。' : response.error, !response.ok);
  await refreshUI();
});

el.endBtn.addEventListener('click', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.END_SESSION });
  setMessage(response.ok ? '終了しました。' : response.error, !response.ok);
  await refreshUI();
});

el.scrollSyncToggle.addEventListener('change', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.TOGGLE_SCROLL_SYNC, enabled: el.scrollSyncToggle.checked });
  setMessage(response.ok ? 'スクロール同期を更新しました。' : response.error, !response.ok);
});

el.urlSyncToggle.addEventListener('change', async () => {
  const response = await sendMessage({ type: MESSAGE_TYPES.TOGGLE_URL_SYNC, enabled: el.urlSyncToggle.checked });
  setMessage(response.ok ? 'URL同期を更新しました。' : response.error, !response.ok);
});

refreshUI().catch((error) => setMessage(safeErrorMessage(error), true));

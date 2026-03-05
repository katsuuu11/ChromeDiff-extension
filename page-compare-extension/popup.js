function withWildcardPath(rawUrl) {
  const parsed = new URL(rawUrl);
  return `${parsed.origin}/*`;
}

function requestOrigins(origins) {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins }, (granted) => {
      if (chrome.runtime.lastError) {
        resolve({ granted: false, error: chrome.runtime.lastError.message });
        return;
      }

      resolve({ granted });
    });
  });
}

function configureComparison(url1, url2) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'CONFIGURE_COMPARISON', url1, url2 }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      resolve(response || { ok: false, error: 'No response from service worker' });
    });
  });
}

function persistUrls(url1, url2) {
  chrome.storage.local.set({
    compareUrl1: url1,
    compareUrl2: url2
  });
}

function readCurrentInputValues() {
  return {
    url1: document.getElementById('url1').value.trim(),
    url2: document.getElementById('url2').value.trim()
  };
}

function restoreSavedUrls() {
  chrome.storage.local.get(['compareUrl1', 'compareUrl2'], (result) => {
    if (result.compareUrl1) {
      document.getElementById('url1').value = result.compareUrl1;
    }
    if (result.compareUrl2) {
      document.getElementById('url2').value = result.compareUrl2;
    }
  });
}

function setupAutoSave() {
  const saveDraft = () => {
    const { url1, url2 } = readCurrentInputValues();
    persistUrls(url1, url2);
  };

  document.getElementById('url1').addEventListener('input', saveDraft);
  document.getElementById('url2').addEventListener('input', saveDraft);
}

async function fillFromCurrentTab(targetInputId) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    alert('現在のタブURLを取得できませんでした。');
    return;
  }

  if (!/^https?:\/\//.test(tab.url)) {
    alert('http/https のページで実行してください。');
    return;
  }

  const targetInput = document.getElementById(targetInputId);
  targetInput.value = tab.url;

  const { url1, url2 } = readCurrentInputValues();
  persistUrls(url1, url2);
}

document.getElementById('fillUrl1').addEventListener('click', () => fillFromCurrentTab('url1'));
document.getElementById('fillUrl2').addEventListener('click', () => fillFromCurrentTab('url2'));

async function handleOpenCompare() {
  const { url1, url2 } = readCurrentInputValues();

  if (!url1 || !url2) {
    alert('両方のURLを入力してください');
    return;
  }

  try {
    new URL(url1);
    new URL(url2);
  } catch (e) {
    alert('有効なURLを入力してください（https://で始まる完全なURL）');
    return;
  }

  const originPermissions = Array.from(new Set([withWildcardPath(url1), withWildcardPath(url2)]));
  const permissionResult = await requestOrigins(originPermissions);

  if (!permissionResult.granted) {
    alert(`比較対象ドメインへのアクセス権限が必要です。\n${permissionResult.error || ''}`.trim());
    return;
  }

  const configResult = await configureComparison(url1, url2);
  if (!configResult.ok) {
    alert(`比較設定の初期化に失敗しました。\n${configResult.error || ''}`.trim());
    return;
  }

  persistUrls(url1, url2);
  chrome.tabs.create({
    url: chrome.runtime.getURL('overlay.html'),
    active: true
  });
}

document.getElementById('openCompare').addEventListener('click', handleOpenCompare);

for (const inputId of ['url1', 'url2']) {
  document.getElementById(inputId).addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleOpenCompare();
  });
}

restoreSavedUrls();
setupAutoSave();

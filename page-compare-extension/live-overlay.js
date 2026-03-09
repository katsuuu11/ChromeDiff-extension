const video1 = document.getElementById('video1');
const video2 = document.getElementById('video2');
const container = document.getElementById('container');

const opacitySlider = document.getElementById('opacity');
const opacityValue = document.getElementById('opacityValue');
const offsetXSlider = document.getElementById('offsetX');
const offsetYSlider = document.getElementById('offsetY');
const offsetXValue = document.getElementById('offsetXValue');
const offsetYValue = document.getElementById('offsetYValue');
const blendToggle = document.getElementById('blendToggle');
const statusEl = document.getElementById('status');
const focusTab1Btn = document.getElementById('focusTab1');
const focusTab2Btn = document.getElementById('focusTab2');

let blendMode = 'difference';
let tab1Id = null;
let tab2Id = null;
let stream1 = null;
let stream2 = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function updateTransform() {
  const x = Number(offsetXSlider.value);
  const y = Number(offsetYSlider.value);
  video2.style.transform = `translate(${x}px, ${y}px)`;
  offsetXValue.textContent = String(x);
  offsetYValue.textContent = String(y);
}

function updateOpacity() {
  const value = Number(opacitySlider.value);
  video2.style.opacity = value / 100;
  opacityValue.textContent = `${value}%`;
}

function updateBlendMode() {
  video2.style.mixBlendMode = blendMode;
  blendToggle.textContent = blendMode === 'difference' ? 'Difference' : 'Normal';
}

async function getTabStream(tabId) {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  });
}

async function initLiveView() {
  const result = await chrome.storage.local.get(['liveCompareTab1Id', 'liveCompareTab2Id', 'liveCompareStartedAt']);
  tab1Id = result.liveCompareTab1Id;
  tab2Id = result.liveCompareTab2Id;

  if (!tab1Id || !tab2Id) {
    setStatus('比較タブ情報がありません。ポップアップから再実行してください。');
    return;
  }

  try {
    stream1 = await getTabStream(tab1Id);
    stream2 = await getTabStream(tab2Id);

    video1.srcObject = stream1;
    video2.srcObject = stream2;

    const startedAt = result.liveCompareStartedAt ? new Date(result.liveCompareStartedAt).toLocaleTimeString() : '';
    setStatus(startedAt ? `Live capture started: ${startedAt}` : 'Live capture ready');
  } catch (error) {
    setStatus(`ライブキャプチャ開始に失敗: ${String(error)}`);
  }
}

async function forwardWheel(deltaX, deltaY) {
  if (!tab1Id || !tab2Id) {
    return;
  }

  for (const tabId of [tab1Id, tab2Id]) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SCROLL_DELTA',
        deltaX,
        deltaY
      });
    } catch (_) {
      // Ignore pages where content script is not available
    }
  }
}

container.addEventListener('wheel', (event) => {
  event.preventDefault();
  forwardWheel(event.deltaX, event.deltaY);
}, { passive: false });

focusTab1Btn.addEventListener('click', async () => {
  if (tab1Id) {
    await chrome.tabs.update(tab1Id, { active: true }).catch(() => {});
  }
});

focusTab2Btn.addEventListener('click', async () => {
  if (tab2Id) {
    await chrome.tabs.update(tab2Id, { active: true }).catch(() => {});
  }
});

opacitySlider.addEventListener('input', updateOpacity);
offsetXSlider.addEventListener('input', updateTransform);
offsetYSlider.addEventListener('input', updateTransform);
blendToggle.addEventListener('click', () => {
  blendMode = blendMode === 'difference' ? 'normal' : 'difference';
  updateBlendMode();
});

window.addEventListener('beforeunload', () => {
  for (const stream of [stream1, stream2]) {
    if (!stream) {
      continue;
    }

    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
});

updateOpacity();
updateTransform();
updateBlendMode();
initLiveView();

(() => {
  if (window.__chromeDiffPairControlBar) return;

  function createControlBar() {
    const host = document.createElement('div');
    host.id = 'chrome-diff-pair-host';
    host.style.position = 'fixed';
    host.style.right = '16px';
    host.style.bottom = '16px';
    host.style.zIndex = '2147483000';
    host.style.pointerEvents = 'none';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .bar{font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#111;color:#fff;border-radius:10px;padding:8px 10px;display:flex;gap:6px;align-items:center;box-shadow:0 4px 12px rgba(0,0,0,.35);pointer-events:auto}
        .btn{border:1px solid #666;background:#222;color:#fff;border-radius:6px;padding:4px 6px;cursor:pointer}
        .pill{background:#1f2937;padding:2px 6px;border-radius:999px}
        .min{display:none}
      </style>
      <div class="bar" id="bar">
        <span class="pill" id="side">--</span>
        <span id="status">比較中</span>
        <button class="btn" id="pause">同期を止める</button>
        <button class="btn" id="realign">位置を合わせる</button>
        <button class="btn" id="end">終了</button>
        <button class="btn" id="minimize">最小化</button>
      </div>
      <button class="btn min" id="restore">Chrome Diff Pair</button>
    `;

    document.documentElement.appendChild(host);

    const bar = shadow.getElementById('bar');
    const restore = shadow.getElementById('restore');
    shadow.getElementById('minimize').addEventListener('click', () => {
      bar.style.display = 'none';
      restore.style.display = 'block';
    });
    restore.addEventListener('click', () => {
      bar.style.display = 'flex';
      restore.style.display = 'none';
    });

    return {
      setState({ sideLabel, syncEnabled, degraded }) {
        shadow.getElementById('side').textContent = sideLabel;
        shadow.getElementById('status').textContent = degraded ? '片方の画面が閉じられました' : (syncEnabled ? '比較中' : '同期停止中');
        shadow.getElementById('pause').textContent = syncEnabled ? '同期を止める' : '同期を再開';
      },
      onPause(handler) { shadow.getElementById('pause').addEventListener('click', handler); },
      onEnd(handler) { shadow.getElementById('end').addEventListener('click', handler); },
      onReAlign(handler) { shadow.getElementById('realign').addEventListener('click', handler); },
    };
  }

  window.__chromeDiffPairControlBar = { createControlBar };
})();

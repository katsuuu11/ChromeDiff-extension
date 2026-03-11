(() => {
  if (window.__chromeDiffPairCompareAgentLoaded) return;
  window.__chromeDiffPairCompareAgentLoaded = true;

  const MESSAGE_TYPES = {
    PAGE_SCROLL: 'PAGE_SCROLL',
    PAGE_NAVIGATED: 'PAGE_NAVIGATED',
    REALIGN_REQUEST: 'REALIGN_REQUEST',
    SESSION_STATE_UPDATED: 'SESSION_STATE_UPDATED',
    END_SESSION: 'END_SESSION',
    CONTROL_PAUSE_SYNC: 'CONTROL_PAUSE_SYNC',
  };

  let controlBar;

  function updateControlBar() {
    const state = window.__chromeDiffPairState;
    if (!controlBar || !state.session) return;
    controlBar.setState({
      sideLabel: state.side === 'left' ? 'ステージング' : '本番',
      syncEnabled: !!state.session.syncEnabled,
      degraded: !!state.session.degraded,
    });
  }

  function ensureControlBar() {
    if (controlBar) return;
    controlBar = window.__chromeDiffPairControlBar.createControlBar();
    controlBar.onPause(async () => {
      const session = window.__chromeDiffPairState.session;
      await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CONTROL_PAUSE_SYNC, enabled: !session.syncEnabled });
    });
    controlBar.onEnd(async () => {
      await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.END_SESSION });
    });
    controlBar.onReAlign(async () => {
      const ratio = window.__chromeDiffPairScrollSync.getScrollRatio();
      await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REALIGN_REQUEST, ratio });
    });
  }

  function init(side) {
    const state = window.__chromeDiffPairState;
    state.side = side;

    ensureControlBar();

    window.__chromeDiffPairScrollSync.registerScrollReporter((ratio) => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PAGE_SCROLL, ratio });
    });

    window.__chromeDiffPairNavSync.registerNavigationReporter((url) => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PAGE_NAVIGATED, url });
    });

    chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' }, (resp) => {
      if (resp?.session) {
        state.session = resp.session;
        updateControlBar();
      }
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'INIT_COMPARE_AGENT') {
      init(message.side);
      return;
    }
    if (message.type === MESSAGE_TYPES.PAGE_SCROLL) {
      window.__chromeDiffPairScrollSync.scrollToRatio(message.ratio);
      return;
    }
    if (message.type === MESSAGE_TYPES.SESSION_STATE_UPDATED) {
      window.__chromeDiffPairState.session = message.session;
      updateControlBar();
    }
  });
})();

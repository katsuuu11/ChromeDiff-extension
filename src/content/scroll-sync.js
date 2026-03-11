(() => {
  if (window.__chromeDiffPairScrollSync) return;

  const THRESHOLD = 0.002;
  const THROTTLE_MS = 40;

  function getScrollableHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0) - window.innerHeight;
  }

  function getScrollRatio() {
    const max = getScrollableHeight();
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  function scrollToRatio(ratio) {
    const state = window.__chromeDiffPairState;
    const max = getScrollableHeight();
    if (max <= 0) return;
    const targetY = Math.round(max * Math.min(1, Math.max(0, ratio)));
    if (Math.abs(window.scrollY - targetY) < 2) return;
    state.lastProgrammaticScrollAt = Date.now();
    window.scrollTo({ top: targetY, behavior: 'auto' });
  }

  function registerScrollReporter(send) {
    let lastSentAt = 0;
    let lastRatio = getScrollRatio();

    window.addEventListener('scroll', () => {
      const state = window.__chromeDiffPairState;
      if (!state?.session?.syncEnabled || !state?.session?.scrollSyncEnabled) return;
      if (Date.now() - state.lastProgrammaticScrollAt < 160) return;

      const ratio = getScrollRatio();
      if (Math.abs(ratio - lastRatio) < THRESHOLD) return;
      if (Date.now() - lastSentAt < THROTTLE_MS) return;

      lastRatio = ratio;
      lastSentAt = Date.now();
      send(ratio);
    }, { passive: true });
  }

  window.__chromeDiffPairScrollSync = {
    getScrollRatio,
    scrollToRatio,
    registerScrollReporter,
  };
})();

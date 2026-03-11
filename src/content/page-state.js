(() => {
  const existing = window.__chromeDiffPairState;
  if (existing) return;

  window.__chromeDiffPairState = {
    side: 'unknown',
    session: null,
    lastProgrammaticScrollAt: 0,
    isMuted: false,
  };
})();

(() => {
  if (window.__chromeDiffPairNavSync) return;

  function registerNavigationReporter(sendUrl) {
    const notify = () => sendUrl(window.location.href);

    window.addEventListener('popstate', notify);
    window.addEventListener('hashchange', notify);

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPush.apply(this, args);
      setTimeout(notify, 0);
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplace.apply(this, args);
      setTimeout(notify, 0);
      return result;
    };

    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        notify();
      }
    }, 1200);
  }

  window.__chromeDiffPairNavSync = { registerNavigationReporter };
})();

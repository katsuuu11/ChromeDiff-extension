const DEFAULT_BOUNDS = { left: 0, top: 0, width: 1440, height: 900 };

export async function getDisplayBounds() {
  try {
    const current = await chrome.windows.getCurrent();
    if (typeof current.left === 'number' && typeof current.top === 'number' && current.width && current.height) {
      return {
        left: current.left,
        top: current.top,
        width: current.width,
        height: current.height,
      };
    }
  } catch (_err) {
    // Fallback below.
  }
  return DEFAULT_BOUNDS;
}

export function computeSplitBounds(bounds) {
  const gap = 0;
  const half = Math.floor((bounds.width - gap) / 2);
  return {
    leftWindow: {
      left: bounds.left,
      top: bounds.top,
      width: half,
      height: bounds.height,
    },
    rightWindow: {
      left: bounds.left + half + gap,
      top: bounds.top,
      width: bounds.width - half - gap,
      height: bounds.height,
    },
  };
}

export async function openPairedWindows(leftUrl, rightUrl) {
  const bounds = await getDisplayBounds();
  const split = computeSplitBounds(bounds);
  const leftWindow = await chrome.windows.create({
    url: leftUrl,
    type: 'normal',
    focused: true,
    ...split.leftWindow,
  });
  const rightWindow = await chrome.windows.create({
    url: rightUrl,
    type: 'normal',
    focused: false,
    ...split.rightWindow,
  });
  return { leftWindow, rightWindow };
}

export async function realignWindows(session) {
  const bounds = await getDisplayBounds();
  const split = computeSplitBounds(bounds);
  if (session.leftWindowId) {
    await chrome.windows.update(session.leftWindowId, split.leftWindow);
  }
  if (session.rightWindowId) {
    await chrome.windows.update(session.rightWindowId, split.rightWindow);
  }
}

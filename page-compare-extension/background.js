// Background service worker for Manifest V3

const CONTENT_SCRIPT_ID = 'page-compare-content-script';

function drawDiffIcon(size) {
  if (typeof OffscreenCanvas === 'undefined') {
    return null;
  }

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const margin = size * 0.05;
  const width = size - margin * 2;
  const radius = size * 0.18;

  // Rounded dark background
  ctx.fillStyle = '#151a21';
  ctx.beginPath();
  ctx.moveTo(margin + radius, margin);
  ctx.lineTo(margin + width - radius, margin);
  ctx.quadraticCurveTo(margin + width, margin, margin + width, margin + radius);
  ctx.lineTo(margin + width, margin + width - radius);
  ctx.quadraticCurveTo(margin + width, margin + width, margin + width - radius, margin + width);
  ctx.lineTo(margin + radius, margin + width);
  ctx.quadraticCurveTo(margin, margin + width, margin, margin + width - radius);
  ctx.lineTo(margin, margin + radius);
  ctx.quadraticCurveTo(margin, margin, margin + radius, margin);
  ctx.closePath();
  ctx.fill();

  // Subtle diagonal highlight
  const gradient = ctx.createLinearGradient(margin, margin, size, size);
  gradient.addColorStop(0, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(margin, size * 0.3);
  ctx.lineTo(size * 0.4, margin);
  ctx.lineTo(size * 0.9, margin);
  ctx.lineTo(size * 0.45, size * 0.6);
  ctx.lineTo(margin, size * 0.6);
  ctx.closePath();
  ctx.fill();

  // Check mark
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.14;
  ctx.beginPath();
  ctx.moveTo(size * 0.27, size * 0.4);
  ctx.lineTo(size * 0.46, size * 0.58);
  ctx.lineTo(size * 0.74, size * 0.31);
  ctx.stroke();

  ctx.strokeStyle = '#95ff4a';
  ctx.lineWidth = size * 0.115;
  ctx.beginPath();
  ctx.moveTo(size * 0.27, size * 0.4);
  ctx.lineTo(size * 0.46, size * 0.58);
  ctx.lineTo(size * 0.74, size * 0.31);
  ctx.stroke();

  // DIFF text
  const fontSize = Math.max(6, Math.floor(size * 0.22));
  ctx.font = `900 ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText('DIFF', size * 0.505, size * 0.785);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('DIFF', size * 0.5, size * 0.775);

  return ctx.getImageData(0, 0, size, size);
}

function setGeneratedIcon() {
  const sizes = [16, 32, 48, 128];
  const imageData = {};

  for (const size of sizes) {
    const data = drawDiffIcon(size);
    if (data) {
      imageData[size] = data;
    }
  }

  if (Object.keys(imageData).length > 0) {
    chrome.action.setIcon({ imageData });
  } else {
    console.warn('Dynamic icon generation skipped because OffscreenCanvas is unavailable.');
  }
}

function toOriginMatchPattern(rawUrl) {
  const parsed = new URL(rawUrl);
  return `${parsed.origin}/*`;
}

async function configureComparisonPermissions(url1, url2) {
  const originPatterns = Array.from(new Set([toOriginMatchPattern(url1), toOriginMatchPattern(url2)]));

  await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] }).catch(() => {});

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_ID,
      js: ['content.js'],
      matches: originPatterns,
      allFrames: true,
      runAt: 'document_start',
      persistAcrossSessions: false
    }
  ]);
}

function headerContainsFrameAncestors(cspHeaderValue) {
  return cspHeaderValue
    .split(';')
    .map((directive) => directive.trim().toLowerCase())
    .some((directive) => directive.startsWith('frame-ancestors'));
}

async function detectFrameBlocking(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store'
    });

    const xfo = response.headers.get('x-frame-options');
    const csp = response.headers.get('content-security-policy');

    const reasons = [];

    if (xfo && xfo.trim()) {
      reasons.push(`X-Frame-Options: ${xfo}`);
    }

    if (csp && headerContainsFrameAncestors(csp)) {
      reasons.push('Content-Security-Policy has frame-ancestors');
    }

    return {
      url,
      blocked: reasons.length > 0,
      reasons
    };
  } catch (error) {
    return {
      url,
      blocked: false,
      reasons: [],
      warning: String(error)
    };
  }
}

async function inspectFrameCompatibility(url1, url2) {
  const checks = await Promise.all([detectFrameBlocking(url1), detectFrameBlocking(url2)]);
  const blockedUrls = checks.filter((item) => item.blocked);

  return {
    canEmbed: blockedUrls.length === 0,
    checks,
    blockedUrls
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'CONFIGURE_COMPARISON') {
    return;
  }

  (async () => {
    try {
      await configureComparisonPermissions(message.url1, message.url2);
      const compatibility = await inspectFrameCompatibility(message.url1, message.url2);
      sendResponse({ ok: true, ...compatibility });
    } catch (error) {
      console.error('Failed to configure comparison permissions', error);
      sendResponse({ ok: false, error: String(error) });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  setGeneratedIcon();
  console.log('Page Compare Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  setGeneratedIcon();
});

setGeneratedIcon();

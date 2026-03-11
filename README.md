# Chrome Diff Pair

Chrome Diff Pair is a Manifest V3 Chrome extension for fast **staging vs production** verification using two **normal Chrome windows** (left/right), with optional scroll and URL sync.

## Feature summary

- Starts a comparison session from two explicit popup inputs: **Staging URL** and **Production URL**.
- Keeps the user in control of final URLs while offering lightweight assist actions:
  - Use current tab as STG or PROD.
  - Generate the other side URL from stored mapping hints.
  - Reuse recent URL pairs.
- Opens two standard Chrome windows and positions them side-by-side.
- Maintains one active session in `chrome.storage.local`.
- Syncs scroll bidirectionally by scroll ratio (handles different page heights better than pixel offset).
- Optional URL/path sync between configured staging/production environments.
- In-page lightweight floating control bar (STG/PROD label, pause/resume sync, end session, re-align).
- Session recovery + degraded mode when one side is closed, with popup action to reopen missing side.

## Installation / setup

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository root (`ChromeDiff-extension`).
5. Click the extension action icon, fill both URLs, and start a session.

## Permissions explanation

- `tabs`: manage comparison tabs, read active-tab URL for assist actions, and navigate paired pages.
- `windows`: create/position two normal comparison windows.
- `scripting`: inject compare agent scripts into compared tabs.
- `storage`: persist active session state plus URL assist hints/history.
- `host_permissions: <all_urls>`: allow operation across user-provided staging/production URLs.

## Store-compliance rationale

This architecture is intentionally designed for Chrome Web Store safety:

- Uses **normal windows**, not iframes.
- Does **not** rewrite/remove response headers.
- Does **not** bypass `X-Frame-Options`, CSP, or `frame-ancestors`.
- Does **not** inject remote code.
- Avoids `eval`/`new Function` and unsafe inline script patterns.

## Known limitations

- Not an overlay/iframe compare tool.
- Not a pixel-perfect visual diff engine.
- Some sites with unusual scroll containers may not sync perfectly.
- Highly dynamic SPA transitions and cross-origin jumps may require additional heuristics.
- Auto-generation of paired URLs depends on previously seen mapping hints.

## Future roadmap (v2+)

- Lightweight DOM/text difference hints.
- Next/previous difference navigation.
- Link mismatch checks.
- Element highlight suggestions.
- Side panel control surface.

## Project structure

```
/src
  /background
    service-worker.js
    session-manager.js
    window-manager.js
    url-mapper.js
    message-router.js
  /content
    compare-agent.js
    scroll-sync.js
    nav-sync.js
    control-bar.js
    page-state.js
  /popup
    popup.html
    popup.css
    popup.js
  /shared
    constants.js
    storage.js
    utils.js
    logger.js
manifest.json
README.md
```

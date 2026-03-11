import { MESSAGE_TYPES } from '../shared/constants.js';
import {
  startSession,
  getSessionState,
  endSession,
  updateToggles,
  resumeSession,
  handlePageScroll,
  handlePageNavigated,
  handleReAlign,
  reopenMissingSide,
} from './session-manager.js';

export function registerMessageRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      switch (message.type) {
        case MESSAGE_TYPES.START_SESSION:
          sendResponse({ ok: true, session: await startSession(message.payload) });
          return;
        case MESSAGE_TYPES.GET_SESSION_STATE:
          sendResponse({ ok: true, session: await getSessionState() });
          return;
        case MESSAGE_TYPES.END_SESSION:
          sendResponse({ ok: true, result: await endSession() });
          return;
        case MESSAGE_TYPES.RESUME_SESSION:
          sendResponse({ ok: true, session: await resumeSession() });
          return;
        case MESSAGE_TYPES.TOGGLE_SCROLL_SYNC:
          sendResponse({ ok: true, session: await updateToggles({ scrollSyncEnabled: message.enabled }) });
          return;
        case MESSAGE_TYPES.TOGGLE_URL_SYNC:
          sendResponse({ ok: true, session: await updateToggles({ urlSyncEnabled: message.enabled }) });
          return;
        case MESSAGE_TYPES.CONTROL_PAUSE_SYNC:
          sendResponse({ ok: true, session: await updateToggles({ syncEnabled: message.enabled }) });
          return;
        case MESSAGE_TYPES.PAGE_SCROLL:
          await handlePageScroll({ tabId: sender.tab?.id, ratio: message.ratio });
          sendResponse({ ok: true });
          return;
        case MESSAGE_TYPES.PAGE_NAVIGATED:
          await handlePageNavigated({ tabId: sender.tab?.id, url: message.url });
          sendResponse({ ok: true });
          return;
        case MESSAGE_TYPES.REALIGN_REQUEST:
          await handleReAlign({ tabId: sender.tab?.id, ratio: message.ratio });
          sendResponse({ ok: true });
          return;
        case MESSAGE_TYPES.REOPEN_MISSING_SIDE:
          sendResponse({ ok: true, session: await reopenMissingSide() });
          return;
        default:
          sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
      }
    })().catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  });
}

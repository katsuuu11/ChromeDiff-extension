import { logger } from '../shared/logger.js';
import { registerMessageRouter } from './message-router.js';
import { recoverSession, registerTabUpdateHooks, notifyWindowClosed, broadcastState } from './session-manager.js';

registerMessageRouter();
registerTabUpdateHooks();

chrome.runtime.onStartup.addListener(async () => {
  const session = await recoverSession();
  if (session) await broadcastState(session);
});

chrome.runtime.onInstalled.addListener(async () => {
  const session = await recoverSession();
  if (session) await broadcastState(session);
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  await notifyWindowClosed(windowId);
});

logger.info('Service worker loaded (store-safe window-based architecture)');

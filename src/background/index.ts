import { isWikiExistsRequest } from "@/lib/messages.ts";

import { checkWikiExists, pruneExpiredExistenceCache } from "./existence.ts";

const GITHUB_URL_PREFIX = "https://github.com/";

const injectContentToTab = async (tab: chrome.tabs.Tab): Promise<void> => {
  if (tab.id === undefined) return;
  if (tab.discarded) return;
  if (tab.url === undefined || !tab.url.startsWith(GITHUB_URL_PREFIX)) return;

  const tabId = tab.id;
  for (const cs of chrome.runtime.getManifest().content_scripts ?? []) {
    const cssFiles = cs.css ?? [];
    const jsFiles = cs.js ?? [];

    if (cssFiles.length > 0) {
      await chrome.scripting.insertCSS({
        target: { tabId, allFrames: true },
        files: cssFiles,
      });
    }
    if (jsFiles.length > 0) {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: jsFiles,
      });
    }
  }
};

/**
 * Manifest content scripts only auto-inject into pages loaded after the
 * extension is installed or updated. Re-inject into GitHub tabs that are
 * already open so buttons appear without a manual reload. The content script
 * itself guards against double injection.
 */
const reinjectAll = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: `${GITHUB_URL_PREFIX}*` });
  for (const tab of tabs) {
    try {
      await injectContentToTab(tab);
    } catch {
      // Continue injecting other tabs even if one tab is unavailable.
    }
  }
};

const bootstrap = (): void => {
  void reinjectAll();
  void pruneExpiredExistenceCache().catch(() => {
    // Cache pruning is best-effort; stale entries are also skipped on read.
  });
};

chrome.runtime.onInstalled.addListener(bootstrap);
chrome.runtime.onStartup.addListener(bootstrap);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isWikiExistsRequest(message)) return false;
  void checkWikiExists(message.key, message.owner, message.repo).then(
    (result) => sendResponse(result),
    () => {
      sendResponse({ exists: null, checkedAt: Date.now() });
    },
  );
  return true; // keep the message channel open for the async response
});

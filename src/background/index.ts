import { isWikiExistsRequest } from "@/lib/messages.ts";

import { checkWikiExists } from "./existence.ts";

const injectContentToTab = async (tab: chrome.tabs.Tab): Promise<void> => {
  if (tab.url === undefined) return;
  if (tab.discarded) return;
  if (tab.id === undefined) return;
  if (!tab.url.startsWith("https://github.com/")) return;

  const manifest = chrome.runtime.getManifest();
  const cs = manifest.content_scripts?.[0];
  const cssFiles = cs?.css ?? [];
  const jsFiles = cs?.js ?? [];

  if (cssFiles.length > 0) {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id, allFrames: true },
      files: cssFiles,
    });
  }
  if (jsFiles.length > 0) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: jsFiles,
    });
  }
};

const reinjectAll = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: "https://github.com/*" });
  for (const tab of tabs) {
    try {
      await injectContentToTab(tab);
    } catch {
      // Continue injecting other tabs even if one tab is unavailable.
    }
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void reinjectAll();
});

chrome.runtime.onStartup.addListener(() => {
  void reinjectAll();
});

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

import {
  isWikiExistsRequest,
  type WikiExistsResponse,
} from "@/lib/messages.ts";
import { WIKIS, type WikiKey } from "@/lib/wikis.ts";

const TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_PREFIX = "ghwb:exists:";
const HEAD_READ_LIMIT_BYTES = 64 * 1024;

// DeepWiki returns HTTP 200 for both indexed and unindexed repos. We confirmed
// (via Chrome DevTools and curl) that unindexed pages render a fixed
// `og:description` template that always contains this exact phrase, while
// indexed pages substitute the repository's real description.
const DEEPWIKI_NOT_INDEXED_MARKER =
  "Think Deep Research for GitHub - powered by Devin";

const readResponseHead = async (
  resp: Response,
  byteLimit: number,
  earlyMarker: string,
): Promise<string> => {
  if (!resp.body) return await resp.text();
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    while (bytes < byteLimit) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (html.includes(earlyMarker)) break;
      if (html.includes("</head>")) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors — we already have what we need
    }
  }
  return html;
};

const cacheKey = (key: WikiKey, owner: string, repo: string): string =>
  `${CACHE_PREFIX}${key}:${owner.toLowerCase()}/${repo.toLowerCase()}`;

const checkWikiExists = async (
  key: WikiKey,
  owner: string,
  repo: string,
): Promise<WikiExistsResponse> => {
  const def = WIKIS[key];
  if (!def.existenceCheck) {
    return { exists: null, checkedAt: Date.now() };
  }

  const ck = cacheKey(key, owner, repo);
  const cached = (await chrome.storage.local.get(ck))[ck] as
    | WikiExistsResponse
    | undefined;
  const now = Date.now();
  if (cached && now - cached.checkedAt < TTL_MS) {
    return cached;
  }

  const url = def.existenceCheck.buildCheckUrl(owner, repo);
  let exists: boolean | null = null;
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (resp.status === 404 || resp.status === 410) {
      exists = false;
    } else if (resp.status === 200) {
      const head = await readResponseHead(
        resp,
        HEAD_READ_LIMIT_BYTES,
        DEEPWIKI_NOT_INDEXED_MARKER,
      );
      exists = !head.includes(DEEPWIKI_NOT_INDEXED_MARKER);
    } else {
      // 5xx, redirects to error pages, etc — treat as unknown so the UI does
      // not falsely mark the button as missing
      exists = null;
    }
  } catch (err) {
    console.error("[gh-wiki-buttons] existence check failed", url, err);
    exists = null;
  }

  const result: WikiExistsResponse = { exists, checkedAt: now };
  // Only persist confident results so transient failures get retried
  if (exists !== null) {
    await chrome.storage.local.set({ [ck]: result });
  }
  return result;
};

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
    } catch (err) {
      console.error("[gh-wiki-buttons] inject failed", err);
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
    (err) => {
      console.error("[gh-wiki-buttons] check error", err);
      sendResponse({ exists: null, checkedAt: Date.now() });
    },
  );
  return true; // keep the message channel open for the async response
});

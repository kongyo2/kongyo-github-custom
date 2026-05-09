import {
  isWikiExistsRequest,
  type WikiExistsResponse,
} from "@/lib/messages.ts";
import {
  loadSettings,
  type DeepWikiExistenceCheckMethod,
} from "@/lib/settings.ts";
import { WIKIS, type WikiKey } from "@/lib/wikis.ts";

const TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_PREFIX = "ghwb:exists:";
const HEAD_READ_LIMIT_BYTES = 64 * 1024;
const DEEPWIKI_MCP_ENDPOINT = "https://mcp.deepwiki.com/mcp";
const DEEPWIKI_MCP_TOOL = "read_wiki_structure";

// DeepWiki returns HTTP 200 for both indexed and unindexed repos. We confirmed
// (via Chrome DevTools and curl) that unindexed pages render a fixed
// `og:description` template that always contains this exact phrase, while
// indexed pages substitute the repository's real description.
const DEEPWIKI_NOT_INDEXED_MARKER =
  "Think Deep Research for GitHub - powered by Devin";

type McpToolResult = {
  content?: unknown;
  structuredContent?: unknown;
  isError?: unknown;
};

type McpJsonRpcResponse = {
  result?: McpToolResult;
  error?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMcpJsonRpcResponse = (
  value: unknown,
): value is McpJsonRpcResponse => {
  if (!isRecord(value)) return false;
  return "result" in value || "error" in value;
};

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

const parseSseJsonMessages = (wire: string): unknown[] => {
  const messages: unknown[] = [];
  let dataLines: string[] = [];

  const flush = (): void => {
    if (dataLines.length === 0) return;
    const data = dataLines.join("\n");
    dataLines = [];
    try {
      messages.push(JSON.parse(data));
    } catch {
      // Ignore malformed event chunks; the caller will treat missing data as
      // an unknown result.
    }
  };

  for (const rawLine of wire.replace(/\r\n/g, "\n").split("\n")) {
    if (rawLine === "") {
      flush();
      continue;
    }
    if (rawLine.startsWith("data:")) {
      dataLines.push(rawLine.slice(5).trimStart());
    }
  }
  flush();

  return messages;
};

const readMcpJsonRpcResponse = async (
  resp: Response,
): Promise<McpJsonRpcResponse | null> => {
  const body = await resp.text();
  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    return parseSseJsonMessages(body).find(isMcpJsonRpcResponse) ?? null;
  }

  try {
    const parsed: unknown = JSON.parse(body);
    return isMcpJsonRpcResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractMcpText = (result: McpToolResult): string => {
  if (isRecord(result.structuredContent)) {
    const text = result.structuredContent["result"];
    if (typeof text === "string") return text;
  }

  if (!Array.isArray(result.content)) return "";
  return result.content
    .map((part: unknown) => {
      if (!isRecord(part)) return "";
      const text = part["text"];
      return typeof text === "string" ? text : "";
    })
    .filter((text) => text.length > 0)
    .join("\n");
};

const isDeepWikiMcpAvailable = (
  text: string,
  owner: string,
  repo: string,
): boolean => {
  const lower = text.toLowerCase();
  const needle = `available pages for ${owner}/${repo}:`.toLowerCase();
  return lower.includes(needle) || lower.startsWith("available pages for ");
};

const isDeepWikiMcpMissing = (text: string): boolean => {
  const lower = text.toLowerCase();
  return (
    (lower.includes("error fetching wiki for ") &&
      (lower.includes("repository not found") ||
        lower.includes("not indexed"))) ||
    lower.includes("to index it")
  );
};

const checkDeepWikiWithMcp = async (
  owner: string,
  repo: string,
): Promise<boolean | null> => {
  const repoName = `${owner}/${repo}`;
  const resp = await fetch(DEEPWIKI_MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: DEEPWIKI_MCP_TOOL,
        arguments: { repoName },
      },
    }),
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!resp.ok) return null;

  const message = await readMcpJsonRpcResponse(resp);
  if (!message || message.error) return null;
  const result = message.result;
  if (!result) return null;

  const text = extractMcpText(result);
  if (isDeepWikiMcpAvailable(text, owner, repo)) return true;
  if (isDeepWikiMcpMissing(text)) return false;
  return null;
};

const checkWithPageMarker = async (url: string): Promise<boolean | null> => {
  const resp = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (resp.status === 404 || resp.status === 410) {
    return false;
  }
  if (resp.status === 200) {
    const head = await readResponseHead(
      resp,
      HEAD_READ_LIMIT_BYTES,
      DEEPWIKI_NOT_INDEXED_MARKER,
    );
    return !head.includes(DEEPWIKI_NOT_INDEXED_MARKER);
  }

  // 5xx, redirects to error pages, etc — treat as unknown so the UI does
  // not falsely mark the button as missing
  return null;
};

const getDeepWikiExistenceCheckMethod =
  async (): Promise<DeepWikiExistenceCheckMethod> => {
    try {
      return (await loadSettings()).existenceCheck.deepwikiMethod;
    } catch {
      return "page";
    }
  };

const cacheKey = (
  key: WikiKey,
  method: DeepWikiExistenceCheckMethod,
  owner: string,
  repo: string,
): string =>
  `${CACHE_PREFIX}${key}:${method}:${owner.toLowerCase()}/${repo.toLowerCase()}`;

const checkWikiExists = async (
  key: WikiKey,
  owner: string,
  repo: string,
): Promise<WikiExistsResponse> => {
  const def = WIKIS[key];
  if (!def.existenceCheck) {
    return { exists: null, checkedAt: Date.now() };
  }

  const method =
    key === "deepwiki" ? await getDeepWikiExistenceCheckMethod() : "page";
  const ck = cacheKey(key, method, owner, repo);
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
    exists =
      key === "deepwiki" && method === "mcp"
        ? await checkDeepWikiWithMcp(owner, repo)
        : await checkWithPageMarker(url);
  } catch {
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

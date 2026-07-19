import { BUILT_IN_SERVICES } from "@/lib/builtInServices.ts";
import { isRecord } from "@/lib/guards.ts";
import type { WikiExistsResponse } from "@/lib/messages.ts";
import { WikiExistsResponseSchema } from "@/lib/schemas.ts";
import {
  loadSettings,
  type DeepWikiExistenceCheckMethod,
} from "@/lib/settings.ts";

/**
 * Positive results are stable (an indexed repo stays indexed), so they can be
 * cached for a long time. Negative results flip as soon as someone triggers
 * indexing, so retry them much sooner.
 */
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const CACHE_PREFIX = "ghwb:exists:";
const HEAD_READ_LIMIT_BYTES = 64 * 1024;
const DEEPWIKI_MCP_ENDPOINT = "https://mcp.deepwiki.com/mcp";
const DEEPWIKI_MCP_TOOL = "read_wiki_structure";

// DeepWiki returns HTTP 200 for both indexed and unindexed repos. Unindexed
// pages render a fixed `og:description` template that always contains this
// exact phrase, while indexed pages substitute the repository's real
// description.
const DEEPWIKI_NOT_INDEXED_MARKER =
  "Think Deep Research for GitHub - powered by Devin";

const ttlFor = (exists: boolean): number =>
  exists ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;

type McpToolResult = {
  content?: unknown;
  structuredContent?: unknown;
  isError?: unknown;
};

type McpJsonRpcResponse = {
  result?: McpToolResult;
  error?: unknown;
};

const isMcpJsonRpcResponse = (value: unknown): value is McpJsonRpcResponse => {
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
      // Ignore malformed event chunks; the caller treats missing data as unknown.
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
  // not falsely mark the button as missing.
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
  key: string,
  method: DeepWikiExistenceCheckMethod,
  owner: string,
  repo: string,
): string =>
  `${CACHE_PREFIX}${key}:${method}:${owner.toLowerCase()}/${repo.toLowerCase()}`;

const readCachedResponse = async (
  ck: string,
): Promise<WikiExistsResponse | null> => {
  const got = await chrome.storage.local.get(ck);
  const parsed = WikiExistsResponseSchema.safeParse(got[ck]);
  if (!parsed.success) return null;
  const cached = parsed.data;
  if (cached.exists === null) return null;
  if (Date.now() - cached.checkedAt >= ttlFor(cached.exists)) return null;
  return cached;
};

const getBuiltInExistenceConfig = (
  key: string,
): { buildCheckUrl: (o: string, r: string) => string } | null => {
  if (!(key in BUILT_IN_SERVICES)) return null;
  const def = BUILT_IN_SERVICES[key as keyof typeof BUILT_IN_SERVICES];
  return def.existenceCheck ?? null;
};

/**
 * Drop cache entries whose TTL has already elapsed (plus any that no longer
 * parse). Without this, `chrome.storage.local` grows by one entry per repo
 * visited, forever. Runs from the service worker on install and startup.
 */
export const pruneExpiredExistenceCache = async (): Promise<void> => {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const stale: string[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(CACHE_PREFIX)) continue;
    const parsed = WikiExistsResponseSchema.safeParse(value);
    if (!parsed.success || parsed.data.exists === null) {
      stale.push(key);
      continue;
    }
    if (now - parsed.data.checkedAt >= ttlFor(parsed.data.exists)) {
      stale.push(key);
    }
  }
  if (stale.length > 0) {
    await chrome.storage.local.remove(stale);
  }
};

const performCheck = async (
  key: string,
  owner: string,
  repo: string,
): Promise<WikiExistsResponse> => {
  const cfg = getBuiltInExistenceConfig(key);
  if (!cfg) {
    return { exists: null, checkedAt: Date.now() };
  }

  const method =
    key === "deepwiki" ? await getDeepWikiExistenceCheckMethod() : "page";
  const ck = cacheKey(key, method, owner, repo);
  const cached = await readCachedResponse(ck);
  if (cached) return cached;

  const now = Date.now();
  let exists: boolean | null = null;
  try {
    exists =
      key === "deepwiki" && method === "mcp"
        ? await checkDeepWikiWithMcp(owner, repo)
        : await checkWithPageMarker(cfg.buildCheckUrl(owner, repo));
  } catch {
    exists = null;
  }

  const result: WikiExistsResponse = { exists, checkedAt: now };
  // Only persist confident results so transient failures get retried.
  if (exists !== null) {
    await chrome.storage.local.set({ [ck]: result });
  }
  return result;
};

// Coalesce concurrent lookups (multiple frames/tabs opening the same repo)
// into one network request per (service, repo).
const inFlight = new Map<string, Promise<WikiExistsResponse>>();

export const checkWikiExists = (
  key: string,
  owner: string,
  repo: string,
): Promise<WikiExistsResponse> => {
  const flightKey = `${key}:${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const pending = inFlight.get(flightKey);
  if (pending) return pending;

  const task = performCheck(key, owner, repo).finally(() => {
    inFlight.delete(flightKey);
  });
  inFlight.set(flightKey, task);
  return task;
};

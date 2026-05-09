import { WIKI_KEYS, type WikiKey } from "./wikis.ts";

export type ButtonSettings = {
  enabled: boolean;
  openInNewTab: boolean;
};

export type DisplayStyle = "icon-text" | "icon-only";
export type GroupingMode = "separate" | "grouped";
export type DeepWikiExistenceCheckMethod = "page" | "mcp";

export type DisplaySettings = {
  style: DisplayStyle;
  grouping: GroupingMode;
};

export type ExistenceCheckSettings = {
  enabled: boolean;
  deepwikiMethod: DeepWikiExistenceCheckMethod;
};

export type Settings = {
  display: DisplaySettings;
  buttons: Record<WikiKey, ButtonSettings>;
  existenceCheck: ExistenceCheckSettings;
};

export const DEFAULT_SETTINGS: Settings = {
  display: { style: "icon-text", grouping: "separate" },
  buttons: {
    deepwiki: { enabled: true, openInNewTab: true },
    codewiki: { enabled: true, openInNewTab: true },
  },
  existenceCheck: { enabled: true, deepwikiMethod: "page" },
};

const STORAGE_KEY = "github-wiki-buttons:settings:v1";

const isButtonSettings = (value: unknown): value is ButtonSettings => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["enabled"] === "boolean" && typeof v["openInNewTab"] === "boolean"
  );
};

const isDisplayStyle = (value: unknown): value is DisplayStyle =>
  value === "icon-text" || value === "icon-only";

const isGroupingMode = (value: unknown): value is GroupingMode =>
  value === "separate" || value === "grouped";

const isDeepWikiExistenceCheckMethod = (
  value: unknown,
): value is DeepWikiExistenceCheckMethod =>
  value === "page" || value === "mcp";

const normalize = (raw: unknown): Settings => {
  const out: Settings = structuredClone(DEFAULT_SETTINGS);
  if (typeof raw !== "object" || raw === null) return out;
  const obj = raw as Record<string, unknown>;

  // New shape: { display, buttons, existenceCheck }
  if ("buttons" in obj || "display" in obj || "existenceCheck" in obj) {
    const display = obj["display"];
    if (typeof display === "object" && display !== null) {
      const d = display as Record<string, unknown>;
      if (isDisplayStyle(d["style"])) out.display.style = d["style"];
      if (isGroupingMode(d["grouping"])) out.display.grouping = d["grouping"];
    }
    const buttons = obj["buttons"];
    if (typeof buttons === "object" && buttons !== null) {
      const b = buttons as Record<string, unknown>;
      for (const key of WIKI_KEYS) {
        if (isButtonSettings(b[key])) out.buttons[key] = b[key];
      }
    }
    const ec = obj["existenceCheck"];
    if (typeof ec === "object" && ec !== null) {
      const e = ec as Record<string, unknown>;
      if (typeof e["enabled"] === "boolean")
        out.existenceCheck.enabled = e["enabled"];
      if (isDeepWikiExistenceCheckMethod(e["deepwikiMethod"])) {
        out.existenceCheck.deepwikiMethod = e["deepwikiMethod"];
      }
    }
    return out;
  }

  // Legacy shape: Record<WikiKey, ButtonSettings>
  for (const key of WIKI_KEYS) {
    const candidate = obj[key];
    if (isButtonSettings(candidate)) {
      out.buttons[key] = candidate;
    }
  }
  return out;
};

export const loadSettings = async (): Promise<Settings> => {
  const got = await chrome.storage.sync.get(STORAGE_KEY);
  return normalize(got[STORAGE_KEY]);
};

export const saveSettings = async (settings: Settings): Promise<void> => {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
};

export const subscribeSettings = (
  handler: (settings: Settings) => void,
): (() => void) => {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ): void => {
    if (areaName !== "sync") return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    handler(normalize(change.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
};

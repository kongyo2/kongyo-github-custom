import { WIKI_KEYS, type WikiKey } from "./wikis.ts";

export type ButtonSettings = {
  enabled: boolean;
  openInNewTab: boolean;
};

export type Settings = Record<WikiKey, ButtonSettings>;

export const DEFAULT_SETTINGS: Settings = {
  deepwiki: { enabled: true, openInNewTab: true },
  codewiki: { enabled: true, openInNewTab: true },
};

const STORAGE_KEY = "github-wiki-buttons:settings:v1";

const isButtonSettings = (value: unknown): value is ButtonSettings => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["enabled"] === "boolean" && typeof v["openInNewTab"] === "boolean"
  );
};

const normalize = (raw: unknown): Settings => {
  const out: Settings = structuredClone(DEFAULT_SETTINGS);
  if (typeof raw !== "object" || raw === null) return out;
  const obj = raw as Record<string, unknown>;
  for (const key of WIKI_KEYS) {
    const candidate = obj[key];
    if (isButtonSettings(candidate)) {
      out[key] = candidate;
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

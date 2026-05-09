import { BUILT_IN_SERVICE_IDS } from "./builtInServices.ts";
import {
  ButtonSettingsSchema,
  DeepWikiExistenceCheckMethodSchema,
  DisplayStyleSchema,
  GroupingModeSchema,
  SettingsSchema,
  type ButtonSettings,
  type Settings,
} from "./schemas.ts";

export type {
  ButtonSettings,
  DeepWikiExistenceCheckMethod,
  DisplaySettings,
  DisplayStyle,
  ExistenceCheckSettings,
  GroupingMode,
  Settings,
} from "./schemas.ts";

const STORAGE_KEY = "github-wiki-buttons:settings:v1";

export const DEFAULT_SETTINGS: Settings = {
  display: { style: "icon-text", grouping: "separate" },
  buttons: {
    deepwiki: { enabled: true, openInNewTab: true },
    codewiki: { enabled: true, openInNewTab: true },
    repomix: { enabled: true, openInNewTab: true },
  },
  existenceCheck: { enabled: true, deepwikiMethod: "page" },
  order: [...BUILT_IN_SERVICE_IDS],
};

const cloneDefaults = (): Settings => structuredClone(DEFAULT_SETTINGS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Lenient parsing — older shapes (no `order`, legacy `Record<WikiKey, ButtonSettings>`)
 * are upgraded silently so users never lose their preferences across versions.
 */
export const normalizeSettings = (raw: unknown): Settings => {
  const parsed = SettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const out = cloneDefaults();
  if (!isRecord(raw)) return out;

  // Modern-ish shape with some keys present
  if ("buttons" in raw || "display" in raw || "existenceCheck" in raw) {
    const display = raw["display"];
    if (isRecord(display)) {
      const styleParsed = DisplayStyleSchema.safeParse(display["style"]);
      if (styleParsed.success) out.display.style = styleParsed.data;
      const groupingParsed = GroupingModeSchema.safeParse(display["grouping"]);
      if (groupingParsed.success) out.display.grouping = groupingParsed.data;
    }
    const buttons = raw["buttons"];
    if (isRecord(buttons)) {
      const next: Record<string, ButtonSettings> = {};
      for (const [key, val] of Object.entries(buttons)) {
        const candidate = ButtonSettingsSchema.safeParse(val);
        if (candidate.success) next[key] = candidate.data;
      }
      // Ensure built-ins always have an entry
      for (const id of BUILT_IN_SERVICE_IDS) {
        next[id] ??= { enabled: true, openInNewTab: true };
      }
      out.buttons = next;
    }
    const ec = raw["existenceCheck"];
    if (isRecord(ec)) {
      if (typeof ec["enabled"] === "boolean") {
        out.existenceCheck.enabled = ec["enabled"];
      }
      const methodParsed = DeepWikiExistenceCheckMethodSchema.safeParse(
        ec["deepwikiMethod"],
      );
      if (methodParsed.success) {
        out.existenceCheck.deepwikiMethod = methodParsed.data;
      }
    }
    if (Array.isArray(raw["order"])) {
      const seen = new Set<string>();
      const order: string[] = [];
      for (const v of raw["order"]) {
        if (typeof v === "string" && !seen.has(v)) {
          order.push(v);
          seen.add(v);
        }
      }
      out.order = order;
    }
    return out;
  }

  // Legacy: Record<BuiltInServiceId, ButtonSettings>
  for (const key of BUILT_IN_SERVICE_IDS) {
    const candidate = ButtonSettingsSchema.safeParse(raw[key]);
    if (candidate.success) out.buttons[key] = candidate.data;
  }
  return out;
};

/**
 * Reconcile settings against the current set of available service IDs.
 *  - drop button entries / order entries that no longer exist
 *  - append newly-added services to the end of the order
 *  - default missing button entries to enabled
 */
export const reconcileSettings = (
  settings: Settings,
  availableServiceIds: readonly string[],
): Settings => {
  const available = new Set(availableServiceIds);
  const buttons: Record<string, ButtonSettings> = {};
  for (const id of availableServiceIds) {
    buttons[id] = settings.buttons[id] ?? {
      enabled: true,
      openInNewTab: true,
    };
  }
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of settings.order) {
    if (available.has(id) && !seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }
  for (const id of availableServiceIds) {
    if (!seen.has(id)) order.push(id);
  }
  return { ...settings, buttons, order };
};

export const loadSettings = async (): Promise<Settings> => {
  const got = await chrome.storage.sync.get(STORAGE_KEY);
  return normalizeSettings(got[STORAGE_KEY]);
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
    handler(normalizeSettings(change.newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
};

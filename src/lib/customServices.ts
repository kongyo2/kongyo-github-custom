import {
  CustomServiceSchema,
  CustomServicesSchema,
  type CustomService,
  type CustomServices,
} from "./schemas.ts";

const INDEX_KEY = "github-wiki-buttons:customServices:v1:index";
const ITEM_PREFIX = "github-wiki-buttons:customServices:v1:item:";

const itemKey = (id: string): string => `${ITEM_PREFIX}${id}`;

const isOurKey = (key: string): boolean =>
  key === INDEX_KEY || key.startsWith(ITEM_PREFIX);

const readIndex = async (): Promise<string[]> => {
  const got = await chrome.storage.sync.get(INDEX_KEY);
  const raw = got[INDEX_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
};

export const loadCustomServices = async (): Promise<CustomServices> => {
  const ids = await readIndex();
  if (ids.length === 0) return [];

  const keys = ids.map(itemKey);
  const items = await chrome.storage.sync.get(keys);

  const out: CustomService[] = [];
  for (const id of ids) {
    const parsed = CustomServiceSchema.safeParse(items[itemKey(id)]);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
};

export const saveCustomServices = async (
  services: CustomServices,
): Promise<void> => {
  const validated = CustomServicesSchema.parse(services);
  const previousIds = await readIndex();
  const nextIds = validated.map((s) => s.id);
  const nextIdSet = new Set(nextIds);

  const writes: Record<string, unknown> = { [INDEX_KEY]: nextIds };
  for (const svc of validated) {
    writes[itemKey(svc.id)] = svc;
  }
  await chrome.storage.sync.set(writes);

  const orphans = previousIds.filter((id) => !nextIdSet.has(id)).map(itemKey);
  if (orphans.length > 0) {
    await chrome.storage.sync.remove(orphans);
  }
};

export const subscribeCustomServices = (
  handler: (services: CustomServices) => void,
): (() => void) => {
  let scheduled = false;
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ): void => {
    if (areaName !== "sync") return;
    let touched = false;
    for (const key of Object.keys(changes)) {
      if (isOurKey(key)) {
        touched = true;
        break;
      }
    }
    if (!touched) return;
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      void loadCustomServices().then(handler);
    });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
};

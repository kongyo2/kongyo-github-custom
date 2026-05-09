import { CustomServicesSchema, type CustomServices } from "./schemas.ts";

const STORAGE_KEY = "github-wiki-buttons:customServices:v1";

export const loadCustomServices = async (): Promise<CustomServices> => {
  const got = await chrome.storage.sync.get(STORAGE_KEY);
  const parsed = CustomServicesSchema.safeParse(got[STORAGE_KEY]);
  return parsed.success ? parsed.data : [];
};

export const saveCustomServices = async (
  services: CustomServices,
): Promise<void> => {
  const validated = CustomServicesSchema.parse(services);
  await chrome.storage.sync.set({ [STORAGE_KEY]: validated });
};

export const subscribeCustomServices = (
  handler: (services: CustomServices) => void,
): (() => void) => {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ): void => {
    if (areaName !== "sync") return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    const parsed = CustomServicesSchema.safeParse(change.newValue);
    handler(parsed.success ? parsed.data : []);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
};

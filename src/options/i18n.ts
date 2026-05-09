export const t = (key: string, fallback?: string): string => {
  const msg = chrome.i18n.getMessage(key);
  if (msg && msg.length > 0) return msg;
  return fallback ?? key;
};

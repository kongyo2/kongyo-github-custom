import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import { t } from "./i18n.ts";
import "./styles/global.css";

// The static HTML ships English; localize the tab title and language for the
// active browser UI locale before React mounts.
document.title = t("optionsTitle", document.title);
try {
  document.documentElement.lang = chrome.i18n.getUILanguage();
} catch {
  // Keep the static lang attribute if the i18n API is unavailable.
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

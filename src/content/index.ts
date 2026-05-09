import {
  DEFAULT_SETTINGS,
  loadSettings,
  subscribeSettings,
  type Settings,
} from "@/lib/settings.ts";
import { WIKI_KEYS, WIKIS } from "@/lib/wikis.ts";

import "./styles.css";

const NAV_SELECTOR = "ul.pagehead-actions";
const CONTAINER_CLASS = "ghwb-container";

let currentSettings: Settings = DEFAULT_SETTINGS;

const parseRepoFromPath = (): { owner: string; repo: string } | null => {
  const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return null;
  if (owner.startsWith("orgs") || owner === "sponsors" || owner === "settings")
    return null;
  return { owner, repo };
};

const removeOurNodes = (): void => {
  for (const el of document.querySelectorAll(`.${CONTAINER_CLASS}`)) {
    el.remove();
  }
};

const buildButton = (
  key: keyof typeof WIKIS,
  owner: string,
  repo: string,
  openInNewTab: boolean,
): HTMLAnchorElement => {
  const def = WIKIS[key];
  const button = document.createElement("a");
  button.className = `${def.className} btn-sm btn BtnGroup-item`;
  button.href = def.buildUrl(owner, repo);
  button.dataset["ghwbKey"] = def.key;
  if (openInNewTab) {
    button.target = "_blank";
    button.rel = "noopener noreferrer";
  }
  button.setAttribute("data-view-component", "true");

  const icon = document.createElement("span");
  icon.className = "octicon";
  const img = document.createElement("img");
  img.src = chrome.runtime.getURL(`${def.iconBase}-64.png`);
  img.width = 16;
  img.height = 16;
  img.alt = def.label;
  icon.appendChild(img);

  button.appendChild(icon);
  button.appendChild(document.createTextNode(def.label));
  return button;
};

const renderButtons = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;

  const repo = parseRepoFromPath();
  if (!repo) {
    removeOurNodes();
    return;
  }

  const enabled = WIKI_KEYS.filter((key) => currentSettings[key].enabled);

  removeOurNodes();
  if (enabled.length === 0) return;

  const container = document.createElement("li");
  container.className = CONTAINER_CLASS;

  const btnGroup = document.createElement("div");
  btnGroup.setAttribute("data-view-component", "true");
  btnGroup.className = "BtnGroup";

  for (const key of enabled) {
    const button = buildButton(
      key,
      repo.owner,
      repo.repo,
      currentSettings[key].openInNewTab,
    );
    btnGroup.appendChild(button);
  }

  container.appendChild(btnGroup);
  navActions.insertBefore(container, navActions.firstChild);
};

const ensureRendered = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;
  if (document.querySelector(`.${CONTAINER_CLASS}`)) return;
  renderButtons();
};

const start = async (): Promise<void> => {
  try {
    currentSettings = await loadSettings();
  } catch (err) {
    console.error("[gh-wiki-buttons] failed to load settings", err);
  }

  renderButtons();

  subscribeSettings((next) => {
    currentSettings = next;
    renderButtons();
  });

  let lastUrl = location.href;
  let isProcessing = false;

  const observer = new MutationObserver(() => {
    if (isProcessing) return;
    isProcessing = true;
    try {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        window.setTimeout(() => {
          renderButtons();
        }, 200);
      } else {
        ensureRendered();
      }
    } finally {
      isProcessing = false;
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
};

void start();

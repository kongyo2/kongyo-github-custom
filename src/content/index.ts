import {
  isWikiExistsRequest as _isWikiExistsRequest,
  type WikiExistsRequest,
  type WikiExistsResponse,
} from "@/lib/messages.ts";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  subscribeSettings,
  type DisplayStyle,
  type Settings,
} from "@/lib/settings.ts";
import { WIKI_KEYS, WIKIS, type WikiKey } from "@/lib/wikis.ts";

import "./styles.css";

void _isWikiExistsRequest; // type-only import keeper

const NAV_SELECTOR = "ul.pagehead-actions";
const CONTAINER_CLASS = "ghwb-container";

let currentSettings: Settings = DEFAULT_SETTINGS;
let renderEpoch = 0;

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
  key: WikiKey,
  owner: string,
  repo: string,
  openInNewTab: boolean,
  style: DisplayStyle,
  inGroup: boolean,
): HTMLAnchorElement => {
  const def = WIKIS[key];
  const button = document.createElement("a");
  const classes = [
    def.className,
    "btn-sm",
    "btn",
    inGroup ? "BtnGroup-item" : "",
    style === "icon-only" ? "ghwb-button--icon-only" : "ghwb-button--with-text",
  ].filter(Boolean);
  button.className = classes.join(" ");
  button.href = def.buildUrl(owner, repo);
  button.dataset["ghwbKey"] = def.key;
  button.title = def.label;
  button.setAttribute("aria-label", def.label);
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
  img.alt = "";
  icon.appendChild(img);

  button.appendChild(icon);
  if (style !== "icon-only") {
    button.appendChild(document.createTextNode(def.label));
  }
  return button;
};

const verifyExistence = (
  button: HTMLAnchorElement,
  key: WikiKey,
  owner: string,
  repo: string,
  epoch: number,
): void => {
  const def = WIKIS[key];
  if (!def.existenceCheck) return;
  if (!currentSettings.existenceCheck.enabled) return;

  const request: WikiExistsRequest = { type: "wiki-exists", key, owner, repo };
  void chrome.runtime
    .sendMessage(request)
    .then((res: WikiExistsResponse | undefined) => {
      if (epoch !== renderEpoch) return;
      if (!button.isConnected) return;
      if (!res) return;
      if (res.exists === false) {
        button.classList.add("ghwb-button--missing");
        button.title = `${def.label} — this repository is not indexed yet`;
      } else if (res.exists === true) {
        button.classList.remove("ghwb-button--missing");
        button.title = def.label;
      }
    })
    .catch(() => undefined);
};

const renderButtons = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;

  const repo = parseRepoFromPath();
  if (!repo) {
    removeOurNodes();
    return;
  }

  const enabled = WIKI_KEYS.filter(
    (key) => currentSettings.buttons[key].enabled,
  );

  removeOurNodes();
  if (enabled.length === 0) return;

  const epoch = ++renderEpoch;
  const { style, grouping } = currentSettings.display;
  const buttonByKey = new Map<WikiKey, HTMLAnchorElement>();

  if (grouping === "grouped") {
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
        currentSettings.buttons[key].openInNewTab,
        style,
        true,
      );
      btnGroup.appendChild(button);
      buttonByKey.set(key, button);
    }

    container.appendChild(btnGroup);
    navActions.insertBefore(container, navActions.firstChild);
  } else {
    for (const key of [...enabled].reverse()) {
      const container = document.createElement("li");
      container.className = CONTAINER_CLASS;
      const button = buildButton(
        key,
        repo.owner,
        repo.repo,
        currentSettings.buttons[key].openInNewTab,
        style,
        false,
      );
      container.appendChild(button);
      navActions.insertBefore(container, navActions.firstChild);
      buttonByKey.set(key, button);
    }
  }

  // Fire existence checks for keys whose definition supports it
  for (const [key, button] of buttonByKey) {
    verifyExistence(button, key, repo.owner, repo.repo, epoch);
  }
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
  } catch {
    // Keep rendering with defaults when synced settings are unavailable.
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

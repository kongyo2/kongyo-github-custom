import {
  loadCustomServices,
  subscribeCustomServices,
} from "@/lib/customServices.ts";
import type { WikiExistsRequest, WikiExistsResponse } from "@/lib/messages.ts";
import type { CustomServices } from "@/lib/schemas.ts";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  reconcileSettings,
  subscribeSettings,
  type Settings,
} from "@/lib/settings.ts";
import { buildServiceMap, type ServiceDefinition } from "@/lib/services.ts";

import { parseRepoFromPath } from "./repo.ts";
import { buildButton, CONTAINER_CLASS, removeRenderedNodes } from "./render.ts";

import "./styles.css";

const NAV_SELECTOR = "ul.pagehead-actions";

let currentSettings: Settings = DEFAULT_SETTINGS;
let currentCustomServices: CustomServices = [];
let renderEpoch = 0;
let renderScheduled = false;

const collectAvailableIds = (): string[] => {
  const map = buildServiceMap(currentCustomServices);
  return Array.from(map.keys());
};

const enabledOrderedServices = (): ServiceDefinition[] => {
  const map = buildServiceMap(currentCustomServices);
  const out: ServiceDefinition[] = [];
  for (const id of currentSettings.order) {
    const def = map.get(id);
    if (!def) continue;
    if (!currentSettings.buttons[id]?.enabled) continue;
    out.push(def);
  }
  return out;
};

const verifyExistence = (
  button: HTMLAnchorElement,
  def: ServiceDefinition,
  owner: string,
  repo: string,
  epoch: number,
): void => {
  if (!def.existenceCheck) return;
  if (!currentSettings.existenceCheck.enabled) return;

  button.classList.add("ghwb-button--checking");
  const previousTitle = button.title;
  button.title = `${def.label} — checking…`;

  const request: WikiExistsRequest = {
    type: "wiki-exists",
    key: def.id,
    owner,
    repo,
  };
  void chrome.runtime
    .sendMessage(request)
    .then((res: WikiExistsResponse | undefined) => {
      if (epoch !== renderEpoch) return;
      if (!button.isConnected) return;
      button.classList.remove("ghwb-button--checking");
      button.title = previousTitle;
      if (!res) return;
      if (res.exists === false) {
        button.classList.add("ghwb-button--missing");
        button.title = `${def.label} — this repository is not indexed yet`;
      } else if (res.exists === true) {
        button.classList.remove("ghwb-button--missing");
        button.title = def.label;
      }
    })
    .catch(() => {
      if (!button.isConnected) return;
      button.classList.remove("ghwb-button--checking");
      button.title = previousTitle;
    });
};

const renderButtons = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;

  const repo = parseRepoFromPath();
  if (!repo) {
    removeRenderedNodes();
    return;
  }

  const services = enabledOrderedServices();

  removeRenderedNodes();
  if (services.length === 0) return;

  const epoch = ++renderEpoch;
  const { style, grouping } = currentSettings.display;
  const rendered: { def: ServiceDefinition; el: HTMLAnchorElement }[] = [];

  if (grouping === "grouped") {
    const container = document.createElement("li");
    container.className = CONTAINER_CLASS;

    const btnGroup = document.createElement("div");
    btnGroup.setAttribute("data-view-component", "true");
    btnGroup.className = "BtnGroup";

    for (const def of services) {
      const button = buildButton(def, repo.owner, repo.repo, {
        openInNewTab: currentSettings.buttons[def.id]?.openInNewTab ?? true,
        style,
        inGroup: true,
      });
      btnGroup.appendChild(button);
      rendered.push({ def, el: button });
    }

    container.appendChild(btnGroup);
    navActions.insertBefore(container, navActions.firstChild);
  } else {
    // Insert in reverse so the first service in `services` ends up leftmost.
    for (const def of [...services].reverse()) {
      const container = document.createElement("li");
      container.className = CONTAINER_CLASS;
      const button = buildButton(def, repo.owner, repo.repo, {
        openInNewTab: currentSettings.buttons[def.id]?.openInNewTab ?? true,
        style,
        inGroup: false,
      });
      container.appendChild(button);
      navActions.insertBefore(container, navActions.firstChild);
      rendered.push({ def, el: button });
    }
  }

  for (const { def, el } of rendered) {
    verifyExistence(el, def, repo.owner, repo.repo, epoch);
  }
};

const scheduleRender = (): void => {
  if (renderScheduled) return;
  renderScheduled = true;
  queueMicrotask(() => {
    renderScheduled = false;
    renderButtons();
  });
};

const ensureRendered = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;
  if (document.querySelector(`.${CONTAINER_CLASS}`)) return;
  scheduleRender();
};

const start = async (): Promise<void> => {
  try {
    const [s, custom] = await Promise.all([
      loadSettings(),
      loadCustomServices(),
    ]);
    currentCustomServices = custom;
    currentSettings = reconcileSettings(s, collectAvailableIds());
  } catch {
    // Keep rendering with defaults when synced settings are unavailable.
  }

  scheduleRender();

  subscribeSettings((next) => {
    currentSettings = reconcileSettings(next, collectAvailableIds());
    scheduleRender();
  });

  subscribeCustomServices((next) => {
    currentCustomServices = next;
    currentSettings = reconcileSettings(currentSettings, collectAvailableIds());
    scheduleRender();
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
        window.setTimeout(scheduleRender, 200);
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

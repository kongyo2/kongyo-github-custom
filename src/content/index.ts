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

declare global {
  interface Window {
    /** Set once per isolated world to guard against double injection. */
    __ghwbContentScriptLoaded?: true;
  }
}

const NAV_SELECTOR = "ul.pagehead-actions";
/** GitHub keeps morphing the page briefly after a soft navigation. */
const NAV_SETTLE_DELAY_MS = 200;
/** Turbo / soft-nav events GitHub dispatches on document after navigation. */
const DOCUMENT_NAV_EVENTS = [
  "turbo:load",
  "turbo:render",
  "soft-nav:success",
] as const;
/** Browser-level events that can also swap the visible page. */
const WINDOW_NAV_EVENTS = ["popstate", "pageshow"] as const;

let currentSettings: Settings = DEFAULT_SETTINGS;
let currentCustomServices: CustomServices = [];
let serviceMap = buildServiceMap(currentCustomServices);
/** Bumped on every settings / custom-services change to invalidate renders. */
let stateRevision = 0;
let renderEpoch = 0;
let renderScheduled = false;
/** Signature + node count of the last completed render, for idempotence. */
let renderedSignature: string | null = null;
let renderedCount = 0;

const teardownCallbacks: (() => void)[] = [];

/**
 * After the extension is updated or reloaded, this world keeps running but
 * every `chrome.*` call throws ("Extension context invalidated"). Detect that
 * and shut down cleanly — already-rendered buttons stay behind as plain links.
 */
const isExtensionAlive = (): boolean => {
  try {
    return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
};

const teardown = (): void => {
  for (const callback of teardownCallbacks.splice(0)) {
    try {
      callback();
    } catch {
      // Best-effort cleanup; the world is going away anyway.
    }
  }
};

const i18nOr = (key: string, subs: string[], fallback: string): string => {
  const msg = chrome.i18n.getMessage(key, subs);
  return msg && msg.length > 0 ? msg : fallback;
};

const refreshServiceMap = (): void => {
  serviceMap = buildServiceMap(currentCustomServices);
};

const collectAvailableIds = (): string[] => Array.from(serviceMap.keys());

const enabledOrderedServices = (): ServiceDefinition[] => {
  const out: ServiceDefinition[] = [];
  for (const id of currentSettings.order) {
    const def = serviceMap.get(id);
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
  button.title = i18nOr(
    "existenceCheckingTitle",
    [def.label],
    `${def.label} — checking…`,
  );

  const restore = (): void => {
    button.classList.remove("ghwb-button--checking");
    button.title = previousTitle;
  };

  const request: WikiExistsRequest = {
    type: "wiki-exists",
    key: def.id,
    owner,
    repo,
  };
  let response: Promise<WikiExistsResponse | undefined>;
  try {
    response = chrome.runtime.sendMessage(request);
  } catch {
    // Extension context died between render and check.
    restore();
    return;
  }
  void response
    .then((res) => {
      if (epoch !== renderEpoch) return;
      if (!button.isConnected) return;
      restore();
      if (!res) return;
      if (res.exists === false) {
        button.classList.add("ghwb-button--missing");
        button.title = i18nOr(
          "existenceMissingTitle",
          [def.label],
          `${def.label} — this repository is not indexed yet`,
        );
      } else if (res.exists === true) {
        button.classList.remove("ghwb-button--missing");
        button.title = def.label;
      }
    })
    .catch(() => {
      if (epoch !== renderEpoch) return;
      if (!button.isConnected) return;
      restore();
    });
};

/**
 * True when the previous render is still exactly what this render would
 * produce: same repo, same settings revision, and every rendered node still
 * sits inside the current nav list. Lets soft-nav events re-fire freely
 * without tearing down and rebuilding identical buttons.
 */
const isRenderIntact = (
  navActions: HTMLUListElement,
  signature: string,
): boolean => {
  if (renderedSignature !== signature) return false;
  const containers = document.querySelectorAll(`.${CONTAINER_CLASS}`);
  if (containers.length !== renderedCount) return false;
  for (const el of containers) {
    if (el.parentElement !== navActions) return false;
  }
  return true;
};

const renderButtons = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;

  const repo = parseRepoFromPath();
  if (!repo) {
    removeRenderedNodes();
    renderedSignature = null;
    return;
  }

  const signature = `${repo.owner}/${repo.repo}::${stateRevision}`;
  if (isRenderIntact(navActions, signature)) return;

  const services = enabledOrderedServices();

  removeRenderedNodes();
  renderedSignature = signature;
  renderedCount = 0;
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
    renderedCount = 1;
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
    renderedCount = services.length;
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
    if (!isExtensionAlive()) {
      teardown();
      return;
    }
    renderButtons();
  });
};

const invalidateAndRender = (): void => {
  stateRevision += 1;
  scheduleRender();
};

/** Re-add buttons when GitHub's DOM morphing wiped them from the nav. */
const ensureRendered = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;
  if (navActions.querySelector(`.${CONTAINER_CLASS}`)) return;
  scheduleRender();
};

const start = async (): Promise<void> => {
  let customSubscriberFired = false;
  let settingsSubscriberFired = false;

  // Subscribe BEFORE the initial reads so events landing mid-flight aren't
  // silently overwritten by the older startup snapshot below.
  teardownCallbacks.push(
    subscribeSettings((next) => {
      settingsSubscriberFired = true;
      currentSettings = reconcileSettings(next, collectAvailableIds());
      invalidateAndRender();
    }),
  );

  teardownCallbacks.push(
    subscribeCustomServices((next) => {
      customSubscriberFired = true;
      currentCustomServices = next;
      refreshServiceMap();
      currentSettings = reconcileSettings(
        currentSettings,
        collectAvailableIds(),
      );
      invalidateAndRender();
    }),
  );

  // Load each datasource independently so a custom-services read failure
  // does not throw away otherwise readable settings (and vice versa).
  const [settingsResult, customResult] = await Promise.allSettled([
    loadSettings(),
    loadCustomServices(),
  ]);
  if (!customSubscriberFired && customResult.status === "fulfilled") {
    currentCustomServices = customResult.value;
    refreshServiceMap();
  }
  if (!settingsSubscriberFired) {
    const base =
      settingsResult.status === "fulfilled"
        ? settingsResult.value
        : DEFAULT_SETTINGS;
    currentSettings = reconcileSettings(base, collectAvailableIds());
  }

  invalidateAndRender();

  let lastUrl = location.href;

  const onSoftNavigation = (): void => {
    if (!isExtensionAlive()) {
      teardown();
      return;
    }
    lastUrl = location.href;
    scheduleRender();
  };

  const observer = new MutationObserver(() => {
    if (!isExtensionAlive()) {
      teardown();
      return;
    }
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Render immediately, then once more after GitHub settles its morphing.
      scheduleRender();
      window.setTimeout(scheduleRender, NAV_SETTLE_DELAY_MS);
    } else {
      ensureRendered();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  teardownCallbacks.push(() => observer.disconnect());

  for (const eventName of DOCUMENT_NAV_EVENTS) {
    document.addEventListener(eventName, onSoftNavigation);
    teardownCallbacks.push(() =>
      document.removeEventListener(eventName, onSoftNavigation),
    );
  }
  for (const eventName of WINDOW_NAV_EVENTS) {
    window.addEventListener(eventName, onSoftNavigation);
    teardownCallbacks.push(() =>
      window.removeEventListener(eventName, onSoftNavigation),
    );
  }
};

// The background worker re-injects into open tabs on install/update, which
// can race the manifest-declared injection on loading pages. Run only once
// per isolated world.
if (!window.__ghwbContentScriptLoaded) {
  window.__ghwbContentScriptLoaded = true;
  void start();
}

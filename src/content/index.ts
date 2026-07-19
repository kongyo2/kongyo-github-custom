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
/**
 * Dispatched on document by each newly injected instance. Any older instance
 * (double injection, or an orphan surviving an extension update) hears it and
 * shuts down, so exactly one instance owns the page. A DOM event is used
 * because it crosses isolated worlds and injection generations, which module
 * or window state cannot be relied on to do.
 */
const INSTANCE_STARTED_EVENT = "kongyo-ghwb#instance-started";

let currentSettings: Settings = DEFAULT_SETTINGS;
let currentCustomServices: CustomServices = [];
let serviceMap = buildServiceMap(currentCustomServices);
/** Bumped on every settings / custom-services change to invalidate renders. */
let stateRevision = 0;
let renderEpoch = 0;
let renderScheduled = false;
/** Signature + node shape of the last completed render, for idempotence. */
let renderedSignature: string | null = null;
let renderedCount = 0;
/** Ordered `|`-joined service ids of the buttons the last render produced. */
let renderedKeys = "";
/** Set once this instance has been torn down (superseded or context died). */
let stopped = false;

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
  stopped = true;
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

const renderSignature = (repo: { owner: string; repo: string }): string =>
  `${repo.owner}/${repo.repo}::${stateRevision}`;

/** Ordered ids of the buttons currently present inside our containers. */
const domButtonKeys = (): string =>
  Array.from(
    document.querySelectorAll<HTMLAnchorElement>(
      `.${CONTAINER_CLASS} .ghwb-button`,
    ),
    (el) => el.dataset["ghwbKey"] ?? "",
  ).join("|");

/**
 * True when the previous render is still exactly what this render would
 * produce: same repo, same settings revision, every rendered node still sits
 * inside the current nav list, and the buttons themselves survived GitHub's
 * DOM morphing (which can strip children while keeping the container). Lets
 * soft-nav events re-fire freely without rebuilding identical buttons.
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
  return domButtonKeys() === renderedKeys;
};

const renderButtons = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;

  const repo = parseRepoFromPath();
  if (!repo) {
    removeRenderedNodes();
    renderedSignature = null;
    renderedKeys = "";
    return;
  }

  const signature = renderSignature(repo);
  if (isRenderIntact(navActions, signature)) return;

  const services = enabledOrderedServices();

  removeRenderedNodes();
  renderedSignature = signature;
  renderedCount = 0;
  renderedKeys = services.map((def) => def.id).join("|");
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
  if (stopped || renderScheduled) return;
  renderScheduled = true;
  queueMicrotask(() => {
    renderScheduled = false;
    if (stopped) return;
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

/** Re-render when GitHub's DOM morphing damaged or removed our buttons. */
const ensureRendered = (): void => {
  const navActions = document.querySelector<HTMLUListElement>(NAV_SELECTOR);
  if (!navActions) return;
  const repo = parseRepoFromPath();
  if (!repo) {
    // Non-repo page that still shows a pagehead nav: drop stale buttons.
    if (renderedSignature !== null) scheduleRender();
    return;
  }
  if (isRenderIntact(navActions, renderSignature(repo))) return;
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
  // A successor instance may have superseded us while the reads were in
  // flight; installing observers now would leak them past teardown().
  if (stopped) return;
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
// can race the manifest-declared injection on loading pages — and after an
// update the previous generation's script may still be running (or may have
// left stale flags behind). Announce this instance so any predecessor shuts
// down, then listen so a successor can shut this instance down in turn.
// dispatchEvent is synchronous: every older listener finishes its teardown
// before this instance proceeds.
document.dispatchEvent(new Event(INSTANCE_STARTED_EVENT));
const onSuperseded = (): void => teardown();
document.addEventListener(INSTANCE_STARTED_EVENT, onSuperseded);
teardownCallbacks.push(() =>
  document.removeEventListener(INSTANCE_STARTED_EVENT, onSuperseded),
);
void start();

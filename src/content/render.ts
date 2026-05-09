import type { DisplayStyle } from "@/lib/settings.ts";
import type { ServiceDefinition } from "@/lib/services.ts";

export const CONTAINER_CLASS = "ghwb-container";

const buildIconElement = (def: ServiceDefinition): HTMLSpanElement => {
  const icon = document.createElement("span");
  icon.className = "octicon ghwb-icon";

  if (def.iconBase) {
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL(`${def.iconBase}-64.png`);
    img.width = 16;
    img.height = 16;
    img.alt = "";
    icon.appendChild(img);
    return icon;
  }

  // Custom service: render an initial-letter chip in the service brand color
  const chip = document.createElement("span");
  chip.className = "ghwb-icon-chip";
  chip.style.backgroundColor = def.brand.from;
  chip.textContent = (def.label.trim().charAt(0) || "?").toUpperCase();
  icon.appendChild(chip);
  return icon;
};

export const buildButton = (
  def: ServiceDefinition,
  owner: string,
  repo: string,
  options: {
    openInNewTab: boolean;
    style: DisplayStyle;
    inGroup: boolean;
  },
): HTMLAnchorElement => {
  const button = document.createElement("a");
  const classes = [
    "ghwb-button",
    `ghwb-button--${def.kind}`,
    def.kind === "built-in" ? `ghwb-button--${def.id}` : "",
    "btn-sm",
    "btn",
    options.inGroup ? "BtnGroup-item" : "",
    options.style === "icon-only"
      ? "ghwb-button--icon-only"
      : "ghwb-button--with-text",
  ].filter(Boolean);
  button.className = classes.join(" ");
  button.href = def.buildUrl(owner, repo);
  button.dataset["ghwbKey"] = def.id;
  button.title = def.label;
  button.setAttribute("aria-label", def.label);
  if (options.openInNewTab) {
    button.target = "_blank";
    button.rel = "noopener noreferrer";
  }
  button.setAttribute("data-view-component", "true");

  button.appendChild(buildIconElement(def));
  if (options.style !== "icon-only") {
    button.appendChild(document.createTextNode(def.label));
  }
  return button;
};

export const removeRenderedNodes = (root: ParentNode = document): void => {
  for (const el of root.querySelectorAll(`.${CONTAINER_CLASS}`)) {
    el.remove();
  }
};

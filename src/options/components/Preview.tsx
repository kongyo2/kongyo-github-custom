import { useMemo } from "react";

import type { CustomServices } from "@/lib/schemas.ts";
import type { Settings } from "@/lib/settings.ts";
import { buildServiceMap, type ServiceDefinition } from "@/lib/services.ts";

import { t } from "../i18n.ts";

type Props = { settings: Settings; customServices: CustomServices };

const previewOwner = "octocat";
const previewRepo = "hello-world";

const ServiceButton = ({
  def,
  iconOnly,
  inGroup,
}: {
  def: ServiceDefinition;
  iconOnly: boolean;
  inGroup: boolean;
}): JSX.Element => (
  <a
    className={[
      "gh-btn",
      "gh-btn--ghwb",
      iconOnly ? "gh-btn--icon-only" : "",
      inGroup ? "gh-btn--in-group" : "",
    ]
      .filter(Boolean)
      .join(" ")}
    data-key={def.id}
    style={{ borderColor: def.brand.ring }}
    href="#"
    onClick={(e) => e.preventDefault()}
    title={def.label}
    aria-label={def.label}
  >
    {def.iconBase ? (
      <img
        src={chrome.runtime.getURL(`${def.iconBase}-64.png`)}
        alt=""
        width={14}
        height={14}
      />
    ) : (
      <span
        className="gh-btn__chip"
        style={{ background: def.brand.from }}
        aria-hidden="true"
      >
        {(def.label.trim().charAt(0) || "?").toUpperCase()}
      </span>
    )}
    {iconOnly ? null : def.label}
  </a>
);

export const Preview = ({ settings, customServices }: Props): JSX.Element => {
  const serviceMap = useMemo(
    () => buildServiceMap(customServices),
    [customServices],
  );
  const enabled: ServiceDefinition[] = [];
  for (const id of settings.order) {
    const def = serviceMap.get(id);
    if (def && settings.buttons[id]?.enabled) enabled.push(def);
  }
  const iconOnly = settings.display.style === "icon-only";
  const grouped = settings.display.grouping === "grouped";

  return (
    <section className="preview" aria-label={t("previewLabel", "Live preview")}>
      <div className="preview__bar">
        <span className="preview__dot" />
        <span className="preview__dot" />
        <span className="preview__dot" />
        <span className="preview__url">
          github.com/{previewOwner}/{previewRepo}
        </span>
      </div>
      <p className="preview__repo">
        <span>{previewOwner} /</span> {previewRepo}
      </p>
      <div className="preview__nav">
        {enabled.length > 0 ? (
          grouped ? (
            <div className="gh-btn-group">
              {enabled.map((def) => (
                <ServiceButton
                  key={def.id}
                  def={def}
                  iconOnly={iconOnly}
                  inGroup
                />
              ))}
            </div>
          ) : (
            enabled.map((def) => (
              <ServiceButton
                key={def.id}
                def={def}
                iconOnly={iconOnly}
                inGroup={false}
              />
            ))
          )
        ) : null}
        <a className="gh-btn" href="#" onClick={(e) => e.preventDefault()}>
          ☆ Star
        </a>
        <a className="gh-btn" href="#" onClick={(e) => e.preventDefault()}>
          ⑂ Fork
        </a>
        <a className="gh-btn" href="#" onClick={(e) => e.preventDefault()}>
          👁 Watch
        </a>
      </div>
      {enabled.length === 0 ? (
        <p className="preview__empty">
          {t("previewEmpty", "All buttons hidden.")}
        </p>
      ) : null}
    </section>
  );
};

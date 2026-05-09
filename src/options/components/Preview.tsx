import type { Settings } from "@/lib/settings.ts";
import { WIKI_KEYS, WIKIS, type WikiKey } from "@/lib/wikis.ts";

import { t } from "../i18n.ts";

type Props = { settings: Settings };

const previewOwner = "octocat";
const previewRepo = "hello-world";

const WikiButton = ({
  wikiKey,
  iconOnly,
  inGroup,
}: {
  wikiKey: WikiKey;
  iconOnly: boolean;
  inGroup: boolean;
}): JSX.Element => {
  const def = WIKIS[wikiKey];
  return (
    <a
      className={[
        "gh-btn",
        "gh-btn--ghwb",
        iconOnly ? "gh-btn--icon-only" : "",
        inGroup ? "gh-btn--in-group" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-key={wikiKey}
      href="#"
      onClick={(e) => e.preventDefault()}
      title={def.label}
      aria-label={def.label}
    >
      <img
        src={chrome.runtime.getURL(`${def.iconBase}-64.png`)}
        alt=""
        width={14}
        height={14}
      />
      {iconOnly ? null : def.label}
    </a>
  );
};

export const Preview = ({ settings }: Props): JSX.Element => {
  const enabledKeys = WIKI_KEYS.filter((key) => settings.buttons[key].enabled);
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
        {enabledKeys.length > 0 ? (
          grouped ? (
            <div className="gh-btn-group">
              {enabledKeys.map((key) => (
                <WikiButton
                  key={key}
                  wikiKey={key}
                  iconOnly={iconOnly}
                  inGroup
                />
              ))}
            </div>
          ) : (
            enabledKeys.map((key) => (
              <WikiButton
                key={key}
                wikiKey={key}
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
      {enabledKeys.length === 0 ? (
        <p className="preview__empty">All Wiki buttons hidden.</p>
      ) : null}
    </section>
  );
};

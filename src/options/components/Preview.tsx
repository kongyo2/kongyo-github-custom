import type { Settings } from "@/lib/settings.ts";
import { WIKI_KEYS, WIKIS } from "@/lib/wikis.ts";

import { t } from "../i18n.ts";

type Props = { settings: Settings };

const previewOwner = "octocat";
const previewRepo = "hello-world";

export const Preview = ({ settings }: Props): JSX.Element => {
  const enabledKeys = WIKI_KEYS.filter((key) => settings[key].enabled);

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
          <div className="gh-btn-group">
            {enabledKeys.map((key) => {
              const def = WIKIS[key];
              return (
                <a
                  key={key}
                  className="gh-btn gh-btn--ghwb"
                  data-key={key}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                >
                  <img
                    src={chrome.runtime.getURL(`${def.iconBase}-64.png`)}
                    alt=""
                    width={14}
                    height={14}
                  />
                  {def.label}
                </a>
              );
            })}
          </div>
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

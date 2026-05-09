import type { ButtonSettings } from "@/lib/settings.ts";
import { WIKIS, type WikiKey } from "@/lib/wikis.ts";

import { t } from "../i18n.ts";
import { Toggle } from "./Toggle.tsx";

type Props = {
  wikiKey: WikiKey;
  value: ButtonSettings;
  onChange: (next: ButtonSettings) => void;
  ordinal: string;
  summary: string;
};

const previewOwner = "octocat";
const previewRepo = "hello-world";

export const WikiCard = ({
  wikiKey,
  value,
  onChange,
  ordinal,
  summary,
}: Props): JSX.Element => {
  const def = WIKIS[wikiKey];
  const previewUrl = def.buildUrl(previewOwner, previewRepo);
  const brand = wikiKey === "deepwiki" ? "var(--deepwiki)" : "var(--codewiki)";
  const cardStyle = {
    ["--brand" as string]: brand,
    ["--card-tint" as string]:
      wikiKey === "deepwiki" ? "rgba(42,74,184,0.07)" : "rgba(60,107,58,0.07)",
  } as React.CSSProperties;

  return (
    <article className="card" data-disabled={!value.enabled} style={cardStyle}>
      <header className="card__header">
        <div className="card__icon">
          <img
            src={chrome.runtime.getURL(`${def.iconBase}-64.png`)}
            alt=""
            width={26}
            height={26}
          />
        </div>
        <h3 className="card__title">{def.label}</h3>
        <span className="card__brand">{ordinal}</span>
      </header>
      <p className="card__summary">{summary}</p>
      <code className="card__url">
        <strong>↗</strong> {previewUrl}
      </code>
      <div className="card__toggles">
        <Toggle
          label={t("settingShowButton", "Show button")}
          hint={t("settingShowButton", "Show button")}
          checked={value.enabled}
          brandColor={brand}
          onChange={(enabled) => onChange({ ...value, enabled })}
        />
        <Toggle
          label={t("settingOpenInNewTab", "Open in new tab")}
          hint="target=_blank"
          checked={value.openInNewTab}
          brandColor={brand}
          onChange={(openInNewTab) => onChange({ ...value, openInNewTab })}
        />
      </div>
    </article>
  );
};

import type { ButtonSettings } from "@/lib/settings.ts";
import type { ServiceDefinition } from "@/lib/services.ts";

import { t } from "../i18n.ts";
import { Toggle } from "./Toggle.tsx";

type Props = {
  service: ServiceDefinition;
  value: ButtonSettings;
  onChange: (next: ButtonSettings) => void;
  ordinal: string;
  summary: string;
  // Reorder controls
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  // Custom-service-only actions
  onEdit?: () => void;
  onDelete?: () => void;
};

const previewOwner = "octocat";
const previewRepo = "hello-world";

export const ServiceCard = ({
  service,
  value,
  onChange,
  ordinal,
  summary,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: Props): JSX.Element => {
  const previewUrl = service.buildUrl(previewOwner, previewRepo);
  const brand = service.brand.from;
  const cardStyle = {
    ["--brand" as string]: brand,
    ["--card-tint" as string]: service.brand.ring,
  } as React.CSSProperties;

  return (
    <article
      className="card"
      data-disabled={!value.enabled}
      data-kind={service.kind}
      style={cardStyle}
    >
      <header className="card__header">
        <div className="card__icon">
          {service.iconBase ? (
            <img
              src={chrome.runtime.getURL(`${service.iconBase}-64.png`)}
              alt=""
              width={26}
              height={26}
            />
          ) : (
            <span
              className="card__icon-chip"
              style={{ background: service.brand.from }}
              aria-hidden="true"
            >
              {(service.label.trim().charAt(0) || "?").toUpperCase()}
            </span>
          )}
        </div>
        <h3 className="card__title">{service.label}</h3>
        <span className="card__brand">{ordinal}</span>
      </header>
      <p className="card__summary">{summary}</p>
      <code className="card__url">
        <strong>↗</strong> {previewUrl}
      </code>
      <div className="card__toggles">
        <Toggle
          label={t("settingShowButton", "Show button")}
          hint={t("settingShowButtonHint", "Show button")}
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
      <div className="card__actions">
        <div className="card__reorder" role="group" aria-label="Reorder">
          <button
            type="button"
            className="card__reorder-btn"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={t("reorderMoveUp", "Move up")}
            title={t("reorderMoveUp", "Move up")}
          >
            ↑
          </button>
          <button
            type="button"
            className="card__reorder-btn"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={t("reorderMoveDown", "Move down")}
            title={t("reorderMoveDown", "Move down")}
          >
            ↓
          </button>
        </div>
        {onEdit ? (
          <button type="button" className="card__action-btn" onClick={onEdit}>
            {t("editLabel", "Edit")}
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="card__action-btn card__action-btn--danger"
            onClick={onDelete}
          >
            {t("deleteLabel", "Delete")}
          </button>
        ) : null}
      </div>
    </article>
  );
};

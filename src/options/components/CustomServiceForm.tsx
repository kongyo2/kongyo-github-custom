import { useState } from "react";

import { CustomServiceSchema, type CustomService } from "@/lib/schemas.ts";
import { generateCustomServiceId } from "@/lib/services.ts";

import { t } from "../i18n.ts";

type Props = {
  initial: CustomService | null;
  existingIds: readonly string[];
  onSubmit: (svc: CustomService) => void;
  onCancel: () => void;
};

const blankDraft = (): CustomService => ({
  id: generateCustomServiceId(),
  label: "",
  urlTemplate: "https://example.com/{owner}/{repo}",
  color: "#6e6e6e",
});

export const CustomServiceForm = ({
  initial,
  existingIds,
  onSubmit,
  onCancel,
}: Props): JSX.Element => {
  const [draft, setDraft] = useState<CustomService>(initial ?? blankDraft());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = <K extends keyof CustomService>(
    key: K,
    value: CustomService[K],
  ): void => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const parsed = CustomServiceSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") next[path] = issue.message;
      }
      setErrors(next);
      return;
    }
    if (!initial && existingIds.includes(parsed.data.id)) {
      setErrors({ id: "A service with this id already exists" });
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form className="custom-form" onSubmit={handleSubmit}>
      <div className="custom-form__row">
        <label className="custom-form__field">
          <span className="custom-form__label">
            {t("customLabel", "Label")}
          </span>
          <input
            className="custom-form__input"
            type="text"
            value={draft.label}
            maxLength={40}
            placeholder="GitHub.dev"
            onChange={(e) => update("label", e.target.value)}
            required
          />
          {errors["label"] ? (
            <span className="custom-form__error">{errors["label"]}</span>
          ) : null}
        </label>
        <label className="custom-form__field custom-form__field--color">
          <span className="custom-form__label">
            {t("customColor", "Color")}
          </span>
          <input
            className="custom-form__color"
            type="color"
            value={draft.color}
            onChange={(e) => update("color", e.target.value)}
          />
        </label>
      </div>
      <label className="custom-form__field">
        <span className="custom-form__label">
          {t("customUrlTemplate", "URL template")}
        </span>
        <input
          className="custom-form__input custom-form__input--mono"
          type="url"
          value={draft.urlTemplate}
          maxLength={400}
          placeholder="https://example.com/{owner}/{repo}"
          onChange={(e) => update("urlTemplate", e.target.value)}
          required
        />
        <span className="custom-form__hint">
          {t(
            "customUrlTemplateHint",
            "Use {owner} and {repo} placeholders. They will be URL-encoded.",
          )}
        </span>
        {errors["urlTemplate"] ? (
          <span className="custom-form__error">{errors["urlTemplate"]}</span>
        ) : null}
      </label>
      <div className="custom-form__actions">
        <button type="submit" className="custom-form__submit">
          {initial
            ? t("customSaveLabel", "Save changes")
            : t("customAddLabel", "Add service")}
        </button>
        <button
          type="button"
          className="custom-form__cancel"
          onClick={onCancel}
        >
          {t("cancelLabel", "Cancel")}
        </button>
      </div>
    </form>
  );
};

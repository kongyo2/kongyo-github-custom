import { t } from "../i18n.ts";

const formatDate = (): string => {
  const d = new Date();
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
};

export const Hero = (): JSX.Element => (
  <header className="hero">
    <div className="hero__masthead">
      <span className="hero__edition">{t("settingsLabel", "Settings")}</span>
      <span className="hero__date">{formatDate()}</span>
    </div>
    <h1 className="hero__title">
      Kongyo
      <br />
      GitHub <em>Custom</em>
    </h1>
    <p className="hero__lede">
      {t(
        "optionsSubhead",
        "Configure the buttons shown on GitHub repository pages.",
      )}
    </p>
    <p className="hero__copy">
      {t(
        "heroCopyButtons",
        "Add shortcuts for DeepWiki, Code Wiki, and Repomix next to the repository action bar.",
      )}
    </p>
    <p className="hero__copy">
      {t(
        "heroCopySettings",
        "Choose which buttons appear, how they are grouped, and whether they open in a new tab.",
      )}
    </p>
  </header>
);

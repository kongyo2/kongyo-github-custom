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
      <span className="hero__edition">Vol. I · Settings Edition</span>
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
        "A pluggable suite of GitHub enhancements. Configure each module below.",
      )}
    </p>
    <p className="hero__copy">
      Modules ship one at a time. Each gets its own card on the right, with its
      own toggles. Disabling a module hides every UI surface it injects.
    </p>
    <p className="hero__copy">
      The inaugural module — <em>Repository Buttons</em> — pins DeepWiki, Code
      Wiki, and Repomix shortcuts next to every repository's Watch / Fork / Star
      bar. More modules will land in this same panel.
    </p>
    <div className="hero__byline">
      <span>Edited locally</span>
      <span>Synced via chrome.storage</span>
      <span>Open source</span>
    </div>
  </header>
);

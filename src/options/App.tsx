import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  subscribeSettings,
  type DisplayStyle,
  type GroupingMode,
  type Settings,
} from "@/lib/settings.ts";
import { WIKI_KEYS } from "@/lib/wikis.ts";

import { Hero } from "./components/Hero.tsx";
import { Preview } from "./components/Preview.tsx";
import { Segmented } from "./components/Segmented.tsx";
import { Toast } from "./components/Toast.tsx";
import { WikiCard } from "./components/WikiCard.tsx";
import { t } from "./i18n.ts";

import "./App.css";

const ROMAN: Readonly<Record<number, string>> = {
  0: "I",
  1: "II",
  2: "III",
  3: "IV",
};

export const App = (): JSX.Element => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [toastShown, setToastShown] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void loadSettings().then((s) => {
      if (!alive) return;
      setSettings(s);
      setLoaded(true);
    });
    const unsubscribe = subscribeSettings((s) => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
      unsubscribe();
      if (toastTimerRef.current !== null)
        window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (): void => {
    setToastShown(true);
    if (toastTimerRef.current !== null)
      window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastShown(false), 1600);
  };

  const persist = (next: Settings): void => {
    setSettings(next);
    void saveSettings(next).then(showToast);
  };

  const summaries: Readonly<Record<(typeof WIKI_KEYS)[number], string>> = {
    deepwiki: t(
      "deepwikiSummary",
      "AI-generated, conversational documentation rendered from the repo.",
    ),
    codewiki: t(
      "codewikiSummary",
      "Google's Code Wiki — explore the repository as a structured wiki.",
    ),
  };

  return (
    <main className="page">
      <div className="page__inner">
        <Hero />

        <div className="column">
          <section className="section">
            <div className="section__head">
              <span className="section__numeral">II.</span>
              <h2 className="section__title">
                {t("moduleWikiButtonsTitle", "Wiki Buttons")}
              </h2>
              <span className="section__rule" />
            </div>
            <p className="section__lede">
              {t(
                "moduleWikiButtonsLede",
                "Add DeepWiki and Code Wiki shortcuts to every GitHub repository page.",
              )}
            </p>

            <div className="display-panel">
              <Segmented<DisplayStyle>
                label={t("settingDisplayStyle", "Display style")}
                hint={t(
                  "settingDisplayStyleHint",
                  "How each button is rendered",
                )}
                value={settings.display.style}
                onChange={(style) =>
                  persist({
                    ...settings,
                    display: { ...settings.display, style },
                  })
                }
                options={[
                  {
                    value: "icon-text",
                    label: t("displayIconText", "Icon + label"),
                  },
                  {
                    value: "icon-only",
                    label: t("displayIconOnly", "Icon only"),
                  },
                ]}
              />
              <Segmented<GroupingMode>
                label={t("settingGrouping", "Grouping")}
                hint={t(
                  "settingGroupingHint",
                  "How adjacent buttons sit next to each other",
                )}
                value={settings.display.grouping}
                onChange={(grouping) =>
                  persist({
                    ...settings,
                    display: { ...settings.display, grouping },
                  })
                }
                options={[
                  {
                    value: "separate",
                    label: t("groupingSeparate", "Separate"),
                  },
                  {
                    value: "grouped",
                    label: t("groupingGrouped", "Joined"),
                  },
                ]}
              />
              <Segmented<"on" | "off">
                label={t("settingExistenceCheck", "Existence check")}
                hint={t(
                  "settingExistenceCheckHint",
                  "Dim buttons whose target page is not yet indexed",
                )}
                value={settings.existenceCheck.enabled ? "on" : "off"}
                onChange={(v) =>
                  persist({
                    ...settings,
                    existenceCheck: { enabled: v === "on" },
                  })
                }
                options={[
                  { value: "on", label: t("existenceOn", "On") },
                  { value: "off", label: t("existenceOff", "Off") },
                ]}
              />
            </div>

            <div className="cards">
              {WIKI_KEYS.map((key, idx) => (
                <WikiCard
                  key={key}
                  wikiKey={key}
                  value={settings.buttons[key]}
                  ordinal={ROMAN[idx] ?? String(idx + 1)}
                  summary={summaries[key]}
                  onChange={(next) =>
                    persist({
                      ...settings,
                      buttons: { ...settings.buttons, [key]: next },
                    })
                  }
                />
              ))}
            </div>
            <div className="actions">
              <button
                className="btn-reset"
                type="button"
                onClick={() => persist(DEFAULT_SETTINGS)}
                disabled={!loaded}
              >
                ↺ {t("settingsResetLabel", "Restore defaults")}
              </button>
              <span className="actions__note">
                {t(
                  "footerNote",
                  "Settings sync across the browsers you are signed into.",
                )}
              </span>
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <span className="section__numeral">III.</span>
              <h2 className="section__title">
                {t("previewLabel", "Live preview")}
              </h2>
              <span className="section__rule" />
            </div>
            <Preview settings={settings} />
          </section>
        </div>
      </div>

      <Toast
        message={t("settingsSavedToast", "Settings saved.")}
        show={toastShown}
      />
    </main>
  );
};

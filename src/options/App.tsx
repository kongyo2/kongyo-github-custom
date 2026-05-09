import { useEffect, useMemo, useRef, useState } from "react";

import {
  loadCustomServices,
  saveCustomServices,
  subscribeCustomServices,
} from "@/lib/customServices.ts";
import type { CustomService, CustomServices } from "@/lib/schemas.ts";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  reconcileSettings,
  saveSettings,
  subscribeSettings,
  type DeepWikiExistenceCheckMethod,
  type DisplayStyle,
  type GroupingMode,
  type Settings,
} from "@/lib/settings.ts";
import { buildServiceMap } from "@/lib/services.ts";

import { CustomServiceForm } from "./components/CustomServiceForm.tsx";
import { Hero } from "./components/Hero.tsx";
import { Preview } from "./components/Preview.tsx";
import { Segmented } from "./components/Segmented.tsx";
import { ServiceCard } from "./components/ServiceCard.tsx";
import { Toast } from "./components/Toast.tsx";
import { t } from "./i18n.ts";

import "./App.css";

const ROMAN: readonly string[] = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
];

const SUMMARY_BY_BUILT_IN: Readonly<Record<string, () => string>> = {
  deepwiki: () =>
    t(
      "deepwikiSummary",
      "AI-generated, conversational documentation rendered from the repo.",
    ),
  codewiki: () =>
    t(
      "codewikiSummary",
      "Google's Code Wiki — explore the repository as a structured wiki.",
    ),
  repomix: () =>
    t(
      "repomixSummary",
      "Pack the repository into an AI-friendly single file with Repomix.",
    ),
};

export const App = (): JSX.Element => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [customServices, setCustomServices] = useState<CustomServices>([]);
  const [loaded, setLoaded] = useState(false);
  const [toastShown, setToastShown] = useState(false);
  const [editingService, setEditingService] = useState<CustomService | null>(
    null,
  );
  const [showAdd, setShowAdd] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const serviceMap = useMemo(
    () => buildServiceMap(customServices),
    [customServices],
  );
  const availableIds = useMemo(
    () => Array.from(serviceMap.keys()),
    [serviceMap],
  );

  // Reconcile settings whenever services change so order/buttons stay in sync.
  useEffect(() => {
    setSettings((prev) => reconcileSettings(prev, availableIds));
  }, [availableIds]);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadSettings(), loadCustomServices()]).then(
      ([s, custom]) => {
        if (!alive) return;
        setCustomServices(custom);
        const map = buildServiceMap(custom);
        setSettings(reconcileSettings(s, Array.from(map.keys())));
        setLoaded(true);
      },
    );
    const unsubscribeSettings = subscribeSettings((s) => {
      if (alive) setSettings(s);
    });
    const unsubscribeCustom = subscribeCustomServices((c) => {
      if (alive) setCustomServices(c);
    });
    return () => {
      alive = false;
      unsubscribeSettings();
      unsubscribeCustom();
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

  const persistSettings = (next: Settings): void => {
    setSettings(next);
    void saveSettings(next).then(showToast);
  };

  const moveService = (id: string, delta: -1 | 1): void => {
    const idx = settings.order.indexOf(id);
    if (idx === -1) return;
    const target = idx + delta;
    if (target < 0 || target >= settings.order.length) return;
    const next = [...settings.order];
    const tmp = next[idx]!;
    next[idx] = next[target]!;
    next[target] = tmp;
    persistSettings({ ...settings, order: next });
  };

  const handleAddCustom = async (svc: CustomService): Promise<void> => {
    const nextCustom = [...customServices, svc];
    const nextSettings: Settings = {
      ...settings,
      buttons: {
        ...settings.buttons,
        [svc.id]: { enabled: true, openInNewTab: true },
      },
      order: [...settings.order, svc.id],
    };
    try {
      await saveCustomServices(nextCustom);
    } catch {
      return;
    }
    setCustomServices(nextCustom);
    setSettings(nextSettings);
    showToast();
    try {
      await saveSettings(nextSettings);
    } catch {
      // Custom service is persisted; settings will reconcile on next save.
    }
    setShowAdd(false);
  };

  const handleUpdateCustom = async (svc: CustomService): Promise<void> => {
    if (!customServices.some((c) => c.id === svc.id)) {
      // The service was deleted while the form was open.
      setEditingService(null);
      return;
    }
    const next = customServices.map((c) => (c.id === svc.id ? svc : c));
    try {
      await saveCustomServices(next);
    } catch {
      return;
    }
    setCustomServices(next);
    showToast();
    setEditingService(null);
  };

  const handleDeleteCustom = async (id: string): Promise<void> => {
    if (!confirm(t("confirmDeleteService", "Delete this service?"))) return;
    const nextCustom = customServices.filter((c) => c.id !== id);
    const nextButtons = { ...settings.buttons };
    delete nextButtons[id];
    const nextSettings: Settings = {
      ...settings,
      buttons: nextButtons,
      order: settings.order.filter((x) => x !== id),
    };
    try {
      await saveCustomServices(nextCustom);
    } catch {
      return;
    }
    setCustomServices(nextCustom);
    setSettings(nextSettings);
    if (editingService?.id === id) setEditingService(null);
    showToast();
    try {
      await saveSettings(nextSettings);
    } catch {
      // Custom service removal landed; settings cleanup will retry on next save.
    }
  };

  return (
    <main className="page">
      <div className="page__inner">
        <Hero />

        <div className="column">
          <section className="section">
            <div className="section__head">
              <span className="section__numeral">I.</span>
              <h2 className="section__title">
                {t("repositoryButtonsTitle", "Repository Buttons")}
              </h2>
              <span className="section__rule" />
            </div>
            <p className="section__lede">
              {t(
                "repositoryButtonsLede",
                "Add DeepWiki, Code Wiki, Repomix and your own shortcuts to every GitHub repository page.",
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
                  persistSettings({
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
                  persistSettings({
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
                  persistSettings({
                    ...settings,
                    existenceCheck: {
                      ...settings.existenceCheck,
                      enabled: v === "on",
                    },
                  })
                }
                options={[
                  { value: "on", label: t("existenceOn", "On") },
                  { value: "off", label: t("existenceOff", "Off") },
                ]}
              />
              <Segmented<DeepWikiExistenceCheckMethod>
                label={t(
                  "settingDeepWikiExistenceMethod",
                  "DeepWiki check method",
                )}
                hint={t(
                  "settingDeepWikiExistenceMethodHint",
                  "MCP calls the official DeepWiki endpoint",
                )}
                value={settings.existenceCheck.deepwikiMethod}
                onChange={(deepwikiMethod) =>
                  persistSettings({
                    ...settings,
                    existenceCheck: {
                      ...settings.existenceCheck,
                      deepwikiMethod,
                    },
                  })
                }
                options={[
                  { value: "page", label: t("existenceMethodPage", "Page") },
                  { value: "mcp", label: t("existenceMethodMcp", "MCP") },
                ]}
              />
            </div>

            <div className="cards">
              {settings.order.map((id, idx) => {
                const def = serviceMap.get(id);
                if (!def) return null;
                const value = settings.buttons[id] ?? {
                  enabled: true,
                  openInNewTab: true,
                };
                const summary =
                  def.kind === "built-in"
                    ? (SUMMARY_BY_BUILT_IN[def.id]?.() ?? "")
                    : t(
                        "customServiceSummary",
                        "Custom service — opens the URL with {owner}/{repo} substituted.",
                      );
                return (
                  <ServiceCard
                    key={id}
                    service={def}
                    value={value}
                    ordinal={ROMAN[idx] ?? String(idx + 1)}
                    summary={summary}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < settings.order.length - 1}
                    onMoveUp={() => moveService(id, -1)}
                    onMoveDown={() => moveService(id, 1)}
                    {...(def.kind === "custom"
                      ? {
                          onEdit: () => setEditingService(def.custom!),
                          onDelete: () => handleDeleteCustom(id),
                        }
                      : {})}
                    onChange={(next) =>
                      persistSettings({
                        ...settings,
                        buttons: { ...settings.buttons, [id]: next },
                      })
                    }
                  />
                );
              })}
            </div>

            <div className="custom-section">
              {editingService ? (
                <CustomServiceForm
                  key={`edit:${editingService.id}`}
                  initial={editingService}
                  existingIds={availableIds}
                  onSubmit={handleUpdateCustom}
                  onCancel={() => setEditingService(null)}
                />
              ) : showAdd ? (
                <CustomServiceForm
                  key="new"
                  initial={null}
                  existingIds={availableIds}
                  onSubmit={handleAddCustom}
                  onCancel={() => setShowAdd(false)}
                />
              ) : (
                <button
                  type="button"
                  className="custom-add-btn"
                  onClick={() => setShowAdd(true)}
                  disabled={!loaded || customServices.length >= 20}
                >
                  + {t("addCustomServiceLabel", "Add custom service")}
                </button>
              )}
              {customServices.length >= 20 ? (
                <span className="custom-section__note">
                  {t(
                    "customServiceLimitNote",
                    "Maximum of 20 custom services reached.",
                  )}
                </span>
              ) : null}
            </div>

            <div className="actions">
              <button
                className="btn-reset"
                type="button"
                onClick={() => {
                  persistSettings(
                    reconcileSettings(DEFAULT_SETTINGS, availableIds),
                  );
                }}
                disabled={!loaded}
              >
                ↺ {t("settingsResetLabel", "Restore defaults")}
              </button>
              <span className="actions__note">
                {t("footerNote", "Settings are saved automatically.")}
              </span>
            </div>
          </section>

          <section className="section">
            <div className="section__head">
              <span className="section__numeral">II.</span>
              <h2 className="section__title">
                {t("previewLabel", "Live preview")}
              </h2>
              <span className="section__rule" />
            </div>
            <Preview settings={settings} customServices={customServices} />
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

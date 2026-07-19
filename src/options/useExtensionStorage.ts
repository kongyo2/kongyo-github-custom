import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import {
  loadCustomServices,
  subscribeCustomServices,
} from "@/lib/customServices.ts";
import type { CustomServices } from "@/lib/schemas.ts";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  reconcileSettings,
  subscribeSettings,
  type Settings,
} from "@/lib/settings.ts";
import { buildServiceMap, type ServiceDefinition } from "@/lib/services.ts";

export type ExtensionStorage = {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  customServices: CustomServices;
  setCustomServices: Dispatch<SetStateAction<CustomServices>>;
  /** True once the initial storage reads finished (even if they failed). */
  loaded: boolean;
  /** True only when an authoritative custom-services snapshot is in memory. */
  customServicesLoaded: boolean;
  serviceMap: Map<string, ServiceDefinition>;
  availableIds: string[];
  /** Mirrors of the latest committed state for async handlers. */
  settingsRef: MutableRefObject<Settings>;
  customServicesRef: MutableRefObject<CustomServices>;
  customServicesLoadedRef: MutableRefObject<boolean>;
};

/**
 * Owns the `chrome.storage.sync` lifecycle for the options page: subscribe
 * before reading so no change event is lost, apply startup snapshots only
 * when no fresher subscription event has landed, and keep settings reconciled
 * against the current service list.
 */
export const useExtensionStorage = (): ExtensionStorage => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [customServices, setCustomServices] = useState<CustomServices>([]);
  const [loaded, setLoaded] = useState(false);
  // Tracks whether we have an authoritative custom-services snapshot. When
  // the initial sync read fails, this stays false and callers block
  // destructive operations (Add / Reset) so a successful save can't truncate
  // the index to only the locally-known items, deleting unloaded sync state.
  const [customServicesLoaded, setCustomServicesLoaded] = useState(false);

  // Mirrors of the latest committed state, kept in sync via the effects
  // below. Used by async handlers and storage subscribers to avoid acting on
  // stale snapshots captured at render time.
  const settingsRef = useRef(settings);
  const customServicesRef = useRef(customServices);
  const customServicesLoadedRef = useRef(customServicesLoaded);
  // Set when a storage subscriber has committed a fresher value than the
  // initial Promise.allSettled snapshot — used to avoid clobbering live
  // updates that arrive while the startup reads are still in flight.
  const customSubscriberFiredRef = useRef(false);
  const settingsSubscriberFiredRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    customServicesRef.current = customServices;
  }, [customServices]);
  useEffect(() => {
    customServicesLoadedRef.current = customServicesLoaded;
  }, [customServicesLoaded]);

  const serviceMap = useMemo(
    () => buildServiceMap(customServices),
    [customServices],
  );
  const availableIds = useMemo(
    () => Array.from(serviceMap.keys()),
    [serviceMap],
  );

  // Reconcile settings whenever services change so order/buttons stay in sync.
  // Skip until we have an authoritative custom-services snapshot; otherwise an
  // initial empty list would strip every custom ID from settings, and a save
  // triggered by display/grouping changes would persist that loss.
  useEffect(() => {
    if (!customServicesLoaded) return;
    setSettings((prev) => reconcileSettings(prev, availableIds));
  }, [availableIds, customServicesLoaded]);

  useEffect(() => {
    let alive = true;
    // Register subscribers BEFORE the initial reads so events that arrive
    // mid-flight aren't lost or overwritten by stale startup snapshots.
    const unsubscribeSettings = subscribeSettings((s) => {
      if (!alive) return;
      settingsSubscriberFiredRef.current = true;
      const ids = Array.from(buildServiceMap(customServicesRef.current).keys());
      setSettings(reconcileSettings(s, ids));
    });
    const unsubscribeCustom = subscribeCustomServices((c) => {
      if (!alive) return;
      customSubscriberFiredRef.current = true;
      setCustomServices(c);
      setCustomServicesLoaded(true);
    });

    void Promise.allSettled([loadSettings(), loadCustomServices()]).then(
      ([settingsResult, customResult]) => {
        if (!alive) return;
        // Only apply startup snapshots if no fresher subscription event has
        // landed in the meantime.
        if (
          !customSubscriberFiredRef.current &&
          customResult.status === "fulfilled"
        ) {
          setCustomServices(customResult.value);
          setCustomServicesLoaded(true);
        }
        if (!settingsSubscriberFiredRef.current) {
          const baseSettings: Settings =
            settingsResult.status === "fulfilled"
              ? settingsResult.value
              : DEFAULT_SETTINGS;
          const ids =
            customResult.status === "fulfilled"
              ? Array.from(buildServiceMap(customResult.value).keys())
              : Array.from(buildServiceMap(customServicesRef.current).keys());
          setSettings(reconcileSettings(baseSettings, ids));
        }
        // Always unblock the UI — even on transient sync failures we can
        // still operate against defaults rather than leaving the page inert.
        setLoaded(true);
      },
    );
    return () => {
      alive = false;
      unsubscribeSettings();
      unsubscribeCustom();
    };
  }, []);

  return {
    settings,
    setSettings,
    customServices,
    setCustomServices,
    loaded,
    customServicesLoaded,
    serviceMap,
    availableIds,
    settingsRef,
    customServicesRef,
    customServicesLoadedRef,
  };
};

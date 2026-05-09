import {
  BUILT_IN_SERVICES,
  BUILT_IN_SERVICE_IDS,
  type BuiltInServiceDefinition,
  type BuiltInServiceId,
  type ExistenceCheckConfig,
} from "./builtInServices.ts";
import type { CustomService } from "./schemas.ts";

export const CUSTOM_SERVICE_PREFIX = "custom:";

export type ServiceKind = "built-in" | "custom";

export type ServiceDefinition = {
  id: string;
  kind: ServiceKind;
  label: string;
  builtIn?: BuiltInServiceDefinition;
  custom?: CustomService;
  /** Resolved gradient + ring colors for UI accents. */
  brand: { from: string; to: string; ring: string };
  /** When omitted (custom services), iconBase is undefined and a generated dot is used. */
  iconBase?: string;
  buildUrl: (owner: string, repo: string) => string;
  existenceCheck?: ExistenceCheckConfig;
};

const adjustHex = (hex: string, delta: number): string => {
  const normalized =
    hex.length === 4
      ? `#${hex[1]!}${hex[1]!}${hex[2]!}${hex[2]!}${hex[3]!}${hex[3]!}`
      : hex;
  const r = Math.max(
    0,
    Math.min(255, parseInt(normalized.slice(1, 3), 16) + delta),
  );
  const g = Math.max(
    0,
    Math.min(255, parseInt(normalized.slice(3, 5), 16) + delta),
  );
  const b = Math.max(
    0,
    Math.min(255, parseInt(normalized.slice(5, 7), 16) + delta),
  );
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const normalized =
    hex.length === 4
      ? `#${hex[1]!}${hex[1]!}${hex[2]!}${hex[2]!}${hex[3]!}${hex[3]!}`
      : hex;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const interpolatePlaceholders = (
  template: string,
  owner: string,
  repo: string,
): string =>
  template
    .replaceAll("{owner}", encodeURIComponent(owner))
    .replaceAll("{repo}", encodeURIComponent(repo));

const customToServiceDefinition = (svc: CustomService): ServiceDefinition => ({
  id: svc.id,
  kind: "custom",
  custom: svc,
  label: svc.label,
  brand: {
    from: svc.color,
    to: adjustHex(svc.color, 30),
    ring: hexToRgba(svc.color, 0.45),
  },
  buildUrl: (owner, repo) =>
    interpolatePlaceholders(svc.urlTemplate, owner, repo),
});

const builtInToServiceDefinition = (
  id: BuiltInServiceId,
): ServiceDefinition => {
  const def = BUILT_IN_SERVICES[id];
  return {
    id: def.id,
    kind: "built-in",
    builtIn: def,
    label: def.label,
    brand: def.brand,
    iconBase: def.iconBase,
    buildUrl: def.buildUrl,
    ...(def.existenceCheck ? { existenceCheck: def.existenceCheck } : {}),
  };
};

export const isBuiltInServiceId = (id: string): id is BuiltInServiceId =>
  (BUILT_IN_SERVICE_IDS as readonly string[]).includes(id);

export const buildServiceDefinitions = (
  customServices: readonly CustomService[],
): ServiceDefinition[] => {
  const list: ServiceDefinition[] = BUILT_IN_SERVICE_IDS.map(
    builtInToServiceDefinition,
  );
  for (const svc of customServices) {
    list.push(customToServiceDefinition(svc));
  }
  return list;
};

export const buildServiceMap = (
  customServices: readonly CustomService[],
): Map<string, ServiceDefinition> => {
  const map = new Map<string, ServiceDefinition>();
  for (const def of buildServiceDefinitions(customServices)) {
    map.set(def.id, def);
  }
  return map;
};

export const generateCustomServiceId = (): string =>
  `${CUSTOM_SERVICE_PREFIX}${crypto.randomUUID()}`;

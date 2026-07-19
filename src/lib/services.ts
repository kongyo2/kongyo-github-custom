import {
  BUILT_IN_SERVICES,
  BUILT_IN_SERVICE_IDS,
  type BuiltInServiceDefinition,
  type BuiltInServiceId,
  type ExistenceCheckConfig,
} from "./builtInServices.ts";
import { CUSTOM_ID_PREFIX, type CustomService } from "./schemas.ts";

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

/** Expand shorthand `#abc` to `#aabbcc`; longhand values pass through. */
const normalizeHex = (hex: string): string =>
  hex.length === 4
    ? `#${hex[1]!}${hex[1]!}${hex[2]!}${hex[2]!}${hex[3]!}${hex[3]!}`
    : hex;

const hexChannels = (hex: string): [number, number, number] => {
  const normalized = normalizeHex(hex);
  return [
    parseInt(normalized.slice(1, 3), 16),
    parseInt(normalized.slice(3, 5), 16),
    parseInt(normalized.slice(5, 7), 16),
  ];
};

const clampChannel = (n: number): number => Math.max(0, Math.min(255, n));

const adjustHex = (hex: string, delta: number): string => {
  const channels = hexChannels(hex).map((c) => clampChannel(c + delta));
  return `#${channels.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexChannels(hex);
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

export const buildServiceDefinitions = (
  customServices: readonly CustomService[],
): ServiceDefinition[] => [
  ...BUILT_IN_SERVICE_IDS.map(builtInToServiceDefinition),
  ...customServices.map(customToServiceDefinition),
];

export const buildServiceMap = (
  customServices: readonly CustomService[],
): Map<string, ServiceDefinition> =>
  new Map(buildServiceDefinitions(customServices).map((def) => [def.id, def]));

export const generateCustomServiceId = (): string =>
  `${CUSTOM_ID_PREFIX}${crypto.randomUUID()}`;

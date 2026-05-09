export type BuiltInServiceId = "deepwiki" | "codewiki" | "repomix";

export type ExistenceCheckConfig = {
  origin: string;
  buildCheckUrl: (owner: string, repo: string) => string;
};

export type BuiltInServiceDefinition = {
  id: BuiltInServiceId;
  label: string;
  iconBase: string;
  buildUrl: (owner: string, repo: string) => string;
  brand: { from: string; to: string; ring: string };
  existenceCheck?: ExistenceCheckConfig;
};

export const BUILT_IN_SERVICE_IDS: readonly BuiltInServiceId[] = [
  "deepwiki",
  "codewiki",
  "repomix",
] as const;

export const BUILT_IN_SERVICES: Readonly<
  Record<BuiltInServiceId, BuiltInServiceDefinition>
> = {
  deepwiki: {
    id: "deepwiki",
    label: "DeepWiki",
    iconBase: "images/deepwiki",
    buildUrl: (owner, repo) => `https://deepwiki.com/${owner}/${repo}`,
    brand: { from: "#5b8def", to: "#9c6cf0", ring: "rgba(91,141,239,0.45)" },
    existenceCheck: {
      origin: "https://deepwiki.com/*",
      buildCheckUrl: (owner, repo) => `https://deepwiki.com/${owner}/${repo}`,
    },
  },
  codewiki: {
    id: "codewiki",
    label: "Code Wiki",
    iconBase: "images/codewiki",
    buildUrl: (owner, repo) =>
      `https://codewiki.google/github.com/${owner}/${repo}`,
    brand: { from: "#34a853", to: "#4285f4", ring: "rgba(66,133,244,0.45)" },
  },
  repomix: {
    id: "repomix",
    label: "Repomix",
    iconBase: "images/repomix",
    buildUrl: (owner, repo) =>
      `https://repomix.com/?repo=${encodeURIComponent(
        `https://github.com/${owner}/${repo}`,
      )}`,
    brand: { from: "#ea7f3a", to: "#f4b55f", ring: "rgba(234,127,58,0.45)" },
  },
};

export const ORIGINS_FOR_EXISTENCE_CHECK: readonly string[] =
  BUILT_IN_SERVICE_IDS.flatMap((id) => {
    const def = BUILT_IN_SERVICES[id];
    return def.existenceCheck ? [def.existenceCheck.origin] : [];
  });

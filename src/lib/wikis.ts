export type WikiKey = "deepwiki" | "codewiki";

export type WikiDefinition = {
  key: WikiKey;
  label: string;
  className: string;
  iconBase: string;
  buildUrl: (owner: string, repo: string) => string;
  brand: { from: string; to: string; ring: string };
};

export const WIKI_KEYS: readonly WikiKey[] = ["deepwiki", "codewiki"] as const;

export const WIKIS: Readonly<Record<WikiKey, WikiDefinition>> = {
  deepwiki: {
    key: "deepwiki",
    label: "DeepWiki",
    className: "ghwb-button ghwb-button--deepwiki",
    iconBase: "images/deepwiki",
    buildUrl: (owner, repo) => `https://deepwiki.com/${owner}/${repo}`,
    brand: { from: "#5b8def", to: "#9c6cf0", ring: "rgba(91,141,239,0.45)" },
  },
  codewiki: {
    key: "codewiki",
    label: "Code Wiki",
    className: "ghwb-button ghwb-button--codewiki",
    iconBase: "images/codewiki",
    buildUrl: (owner, repo) =>
      `https://codewiki.google/github.com/${owner}/${repo}`,
    brand: { from: "#34a853", to: "#4285f4", ring: "rgba(66,133,244,0.45)" },
  },
};

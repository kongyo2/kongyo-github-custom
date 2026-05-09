import type { WikiKey } from "./wikis.ts";

export type WikiExistsRequest = {
  type: "wiki-exists";
  key: WikiKey;
  owner: string;
  repo: string;
};

export type WikiExistsResponse = {
  exists: boolean | null;
  checkedAt: number;
};

export const isWikiExistsRequest = (
  value: unknown,
): value is WikiExistsRequest => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v["type"] === "wiki-exists" &&
    typeof v["key"] === "string" &&
    typeof v["owner"] === "string" &&
    typeof v["repo"] === "string"
  );
};

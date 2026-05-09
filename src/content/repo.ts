/**
 * GitHub paths that look like `/x/y` but are not user-or-org repositories.
 * Keep this list small — false positives only suppress our buttons, which is
 * benign, while false negatives risk rendering buttons on the wrong page.
 */
const RESERVED_OWNERS: ReadonlySet<string> = new Set([
  "orgs",
  "sponsors",
  "settings",
  "marketplace",
  "issues",
  "pulls",
  "notifications",
  "explore",
  "topics",
  "trending",
  "collections",
  "events",
  "search",
  "new",
  "login",
  "logout",
  "join",
  "about",
  "contact",
  "site",
  "features",
  "pricing",
  "enterprise",
  "customer-stories",
  "readme",
  "security",
  "codespaces",
  "sessions",
]);

const RESERVED_REPO_SEGMENTS: ReadonlySet<string> = new Set([
  "followers",
  "following",
  "stars",
  "tab",
]);

export const parseRepoFromPath = (
  pathname: string = window.location.pathname,
): { owner: string; repo: string } | null => {
  const match = pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return null;
  if (RESERVED_OWNERS.has(owner)) return null;
  if (RESERVED_REPO_SEGMENTS.has(repo)) return null;
  // GitHub repository names cannot end with `.git` in the URL nor contain dots-only
  if (repo === "." || repo === "..") return null;
  return { owner, repo };
};

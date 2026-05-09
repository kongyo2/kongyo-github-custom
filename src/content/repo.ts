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

export const parseRepoFromPath = (
  pathname: string = window.location.pathname,
): { owner: string; repo: string } | null => {
  const match = pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return null;
  if (RESERVED_OWNERS.has(owner)) return null;
  // We deliberately do not blacklist repo segments such as `followers`,
  // `stars`, or `tab` — they look like profile concepts but are valid
  // repository names. Pages that aren't repositories simply lack the
  // `pagehead-actions` nav we hook into, so rendering becomes a no-op.
  if (repo === "." || repo === "..") return null;
  return { owner, repo };
};

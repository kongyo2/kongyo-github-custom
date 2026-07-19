import { defineManifest } from "@crxjs/vite-plugin";

import pkg from "../package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "__MSG_appName__",
  short_name: "kongyo-gh",
  description: "__MSG_appDescription__",
  version: pkg.version,
  default_locale: "en",
  // AbortSignal.timeout() (used by the existence check) requires Chrome 103.
  minimum_chrome_version: "103",

  icons: {
    "16": "images/icon-16.png",
    "32": "images/icon-32.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png",
  },

  permissions: ["storage", "scripting"],
  host_permissions: [
    "https://github.com/*",
    "https://deepwiki.com/*",
    "https://mcp.deepwiki.com/*",
  ],

  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },

  content_scripts: [
    {
      matches: ["https://github.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_start",
      all_frames: true,
    },
  ],

  options_ui: {
    page: "src/options/index.html",
    open_in_tab: true,
  },

  web_accessible_resources: [
    {
      // Only the 64px icons are ever loaded from the GitHub page; exposing
      // nothing else keeps the fingerprinting surface minimal.
      resources: [
        "images/deepwiki-64.png",
        "images/codewiki-64.png",
        "images/repomix-64.png",
      ],
      matches: ["https://github.com/*"],
    },
  ],
});

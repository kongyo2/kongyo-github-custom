import { z } from "zod";

export const DisplayStyleSchema = z.enum(["icon-text", "icon-only"]);
export type DisplayStyle = z.infer<typeof DisplayStyleSchema>;

export const GroupingModeSchema = z.enum(["separate", "grouped"]);
export type GroupingMode = z.infer<typeof GroupingModeSchema>;

export const DeepWikiExistenceCheckMethodSchema = z.enum(["page", "mcp"]);
export type DeepWikiExistenceCheckMethod = z.infer<
  typeof DeepWikiExistenceCheckMethodSchema
>;

export const ButtonSettingsSchema = z.object({
  enabled: z.boolean(),
  openInNewTab: z.boolean(),
});
export type ButtonSettings = z.infer<typeof ButtonSettingsSchema>;

export const DisplaySettingsSchema = z.object({
  style: DisplayStyleSchema,
  grouping: GroupingModeSchema,
});
export type DisplaySettings = z.infer<typeof DisplaySettingsSchema>;

export const ExistenceCheckSettingsSchema = z.object({
  enabled: z.boolean(),
  deepwikiMethod: DeepWikiExistenceCheckMethodSchema,
});
export type ExistenceCheckSettings = z.infer<
  typeof ExistenceCheckSettingsSchema
>;

export const SettingsSchema = z.object({
  display: DisplaySettingsSchema,
  buttons: z.record(z.string(), ButtonSettingsSchema),
  existenceCheck: ExistenceCheckSettingsSchema,
  order: z.array(z.string()),
});
export type Settings = z.infer<typeof SettingsSchema>;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const CUSTOM_ID_PREFIX = "custom:";

export const CustomServiceSchema = z.object({
  id: z
    .string()
    .min(CUSTOM_ID_PREFIX.length + 1)
    .startsWith(CUSTOM_ID_PREFIX, `id must start with "${CUSTOM_ID_PREFIX}"`),
  label: z.string().trim().min(1).max(40),
  urlTemplate: z
    .string()
    .trim()
    .min(1)
    .max(400)
    .refine(
      (s) => /^https?:\/\//i.test(s),
      "URL must start with http:// or https://",
    )
    .refine(
      (s) => s.includes("{owner}") && s.includes("{repo}"),
      "URL must include {owner} and {repo} placeholders",
    ),
  color: z
    .string()
    .regex(HEX_COLOR, "Color must be a hex value like #aabbcc")
    .default("#6e6e6e"),
});
export type CustomService = z.infer<typeof CustomServiceSchema>;

export const MAX_CUSTOM_SERVICES = 20;

export const CustomServicesSchema = z
  .array(CustomServiceSchema)
  .max(MAX_CUSTOM_SERVICES)
  .refine(
    (arr) => new Set(arr.map((s) => s.id)).size === arr.length,
    "Custom service ids must be unique",
  );
export type CustomServices = z.infer<typeof CustomServicesSchema>;

export const WikiExistsRequestSchema = z.object({
  type: z.literal("wiki-exists"),
  key: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
});
export type WikiExistsRequest = z.infer<typeof WikiExistsRequestSchema>;

export const WikiExistsResponseSchema = z.object({
  exists: z.boolean().nullable(),
  checkedAt: z.number(),
});
export type WikiExistsResponse = z.infer<typeof WikiExistsResponseSchema>;

import { WikiExistsRequestSchema, type WikiExistsRequest } from "./schemas.ts";

export type { WikiExistsRequest, WikiExistsResponse } from "./schemas.ts";

export const isWikiExistsRequest = (
  value: unknown,
): value is WikiExistsRequest =>
  WikiExistsRequestSchema.safeParse(value).success;

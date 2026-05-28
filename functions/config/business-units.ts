export type BusinessUnitKeywords = Record<string, string[]>;

/**
 * Default keyword map stored in code so long term lists do not have
 * to live in a single Cloudflare environment variable.
 */
export const DEFAULT_BUSINESS_UNIT_KEYWORDS: BusinessUnitKeywords = {
  all: [],
};

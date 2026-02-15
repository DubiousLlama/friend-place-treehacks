/**
 * AI feature configuration.
 *
 * Every AI surface reads from here so features can be toggled via env vars
 * without touching component code.  When `enabled` is false the entire AI
 * layer is a no-op and callers fall back to static defaults.
 */

export const aiConfig = {
  /** Master kill-switch – set AI_ENABLED=false to disable everything */
  enabled: process.env.AI_ENABLED !== "false",

  /** Anthropic API key (server-side only) */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  /** Per-feature toggles */
  dailyAxis: process.env.AI_DAILY_AXIS !== "false",
  suggestAxes: process.env.AI_SUGGEST_AXES !== "false",

  /** Max custom regenerations per user per day (enforced client-side) */
  maxRegenerationsPerDay: 2,

  /** Bright Data – optional, enhances prompts with trending context */
  brightData: {
    enabled: !!process.env.BRIGHTDATA_API_KEY,
    apiKey: process.env.BRIGHTDATA_API_KEY ?? "",
    serpZone: process.env.BRIGHTDATA_SERP_ZONE ?? "serp_api1",
    unlockerZone: process.env.BRIGHTDATA_UNLOCKER_ZONE ?? "web_unlocker1",
  },
} as const;

/** Quick check usable in API routes before doing any work */
export function isAIAvailable(): boolean {
  return aiConfig.enabled && aiConfig.anthropicApiKey.length > 0;
}

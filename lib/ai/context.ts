/**
 * Builds temporal context (date, day of week, season, holidays)
 * that gets injected into every AI prompt so the output feels timely.
 *
 * This module has ZERO external dependencies – it works even if
 * Bright Data is unconfigured. Trending-internet context from
 * Bright Data will be layered in later as an optional enhancement.
 */

interface SeasonalContext {
  date: string;          // "February 14, 2026"
  dayOfWeek: string;     // "Saturday"
  season: string;        // "winter"
  holidays: string[];    // ["Valentine's Day"]
  note: string;          // human-readable one-liner for the prompt
}

const KNOWN_HOLIDAYS: Record<string, string[]> = {
  "01-01": ["New Year's Day"],
  "02-14": ["Valentine's Day"],
  "03-17": ["St. Patrick's Day"],
  "04-01": ["April Fools' Day"],
  "07-04": ["Independence Day"],
  "10-31": ["Halloween"],
  "11-28": ["Thanksgiving"],  // approximate
  "12-25": ["Christmas"],
  "12-31": ["New Year's Eve"],
};

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

export function getSeasonalContext(now = new Date()): SeasonalContext {
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const key = `${mm}-${dd}`;

  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  const season = getSeason(month);
  const holidays = KNOWN_HOLIDAYS[key] ?? [];

  // Build a natural-language note
  const parts: string[] = [`Today is ${dayOfWeek}, ${dateStr}.`, `Season: ${season}.`];
  if (holidays.length > 0) {
    parts.push(`Holiday: ${holidays.join(", ")}.`);
  }

  return { date: dateStr, dayOfWeek, season, holidays, note: parts.join(" ") };
}

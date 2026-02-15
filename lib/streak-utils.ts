/**
 * Per-group streak: consecutive days with at least one game in the group.
 * Game "day" is derived from created_at (UTC date string YYYY-MM-DD).
 */

export function getGameDatesFromGames<
  T extends { created_at: string } | { created_at: string; group_id?: string | null }
>(games: T[], groupId?: string | null): string[] {
  const filtered = groupId
    ? games.filter((g) => "group_id" in g && g.group_id === groupId)
    : games;
  const dates = new Set(
    filtered.map((g) => new Date(g.created_at).toISOString().slice(0, 10))
  );
  return Array.from(dates).sort();
}

/**
 * Compute streak: longest run of consecutive days ending at the latest date.
 * Dates are YYYY-MM-DD strings, sorted ascending.
 */
export function computeStreakFromSortedDates(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  let streak = 1;
  let maxStreak = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    const curr = new Date(sortedDates[i]).getTime();
    const prev = new Date(sortedDates[i - 1]).getTime();
    const diffDays = (curr - prev) / (24 * 60 * 60 * 1000);
    if (diffDays === 1) {
      streak += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 1;
    }
  }
  return maxStreak;
}

/**
 * Given games (with created_at and optional group_id), return the streak for a group.
 */
export function getGroupStreak<
  T extends { created_at: string; group_id?: string | null }
>(games: T[], groupId: string | null): number {
  if (!groupId) return 0;
  const dates = getGameDatesFromGames(games, groupId);
  return computeStreakFromSortedDates(dates);
}

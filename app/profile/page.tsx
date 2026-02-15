"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getGroupStreak } from "@/lib/streak-utils";
import { AccountPrompt } from "@/components/AccountPrompt";

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

interface GameRankEntry {
  gameId: string;
  inviteCode: string;
  axesLabel: string;
  createdAt: string;
  myRank: number;
  totalPlayers: number;
  groupName: string;
}

export interface CandidateTag {
  label: string;
  agreement_pct: number;
  game_id: string;
  source_axis: "x" | "y";
}

export interface FeaturedTag {
  id: string;
  label: string;
  agreement_pct: number;
  game_id: string | null;
  source_axis: "x" | "y" | null;
  sort_order: number;
}

interface CurrentGameEntry {
  game: {
    id: string;
    invite_code: string;
    group_id: string | null;
    axis_x_label_low: string;
    axis_x_label_high: string;
    axis_y_label_low: string;
    axis_y_label_high: string;
  };
  groupName: string;
  streak: number;
}

function getRankSuffix(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

export default function ProfilePage() {
  const { user, loading: authLoading, isLinked } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<GameRankEntry[]>([]);
  const [gamesCount, setGamesCount] = useState(0);
  const [bestRank, setBestRank] = useState<number | null>(null);
  const [featuredTags, setFeaturedTags] = useState<FeaturedTag[]>([]);
  const [candidateTags, setCandidateTags] = useState<CandidateTag[]>([]);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [currentGames, setCurrentGames] = useState<CurrentGameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
      return;
    }
    if (!user || !isLinked) return;

    const run = async () => {
      const supabase = createClient();

      const { data: player } = await supabase
        .from("players")
        .select("display_name")
        .eq("id", user.id)
        .single();
      setDisplayName(player?.display_name ?? null);

      const { data: featuredRows } = await supabase
        .from("user_featured_tags")
        .select("id, label, agreement_pct, game_id, source_axis, sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });
      setFeaturedTags((featuredRows ?? []) as FeaturedTag[]);

      const { data: mySlots } = await supabase
        .from("game_players")
        .select("id, game_id, display_name, self_x, self_y")
        .eq("player_id", user.id);

      const gameIds = [...new Set((mySlots ?? []).map((s) => s.game_id))];
      const { data: gamesData } = await supabase
        .from("games")
        .select("id, invite_code, phase, created_at, group_id, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
        .in("id", gameIds)
        .eq("phase", "results")
        .order("created_at", { ascending: false });

      const { data: placingGames } = await supabase
        .from("games")
        .select("id, invite_code, group_id, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
        .in("id", gameIds)
        .eq("phase", "placing")
        .order("created_at", { ascending: false });
      const groupIds = [...new Set((placingGames ?? []).map((g) => g.group_id).filter(Boolean) as string[])];
      let groupNames: Record<string, string> = {};
      let allGroupGames: { created_at: string; group_id: string | null }[] = [];
      if (groupIds.length > 0) {
        const { data: grp } = await supabase.from("saved_groups").select("id, name").in("id", groupIds);
        const { data: mems } = await supabase.from("group_members").select("group_id, display_name").in("group_id", groupIds).order("sort_order", { ascending: true });
        const membersByGroup = new Map<string, string[]>();
        for (const m of mems ?? []) {
          const list = membersByGroup.get(m.group_id) ?? [];
          list.push(m.display_name);
          membersByGroup.set(m.group_id, list);
        }
        for (const g of grp ?? []) {
          groupNames[g.id] = g.name && g.name.trim() !== "" ? g.name : (membersByGroup.get(g.id) ?? []).join(", ");
        }
        const { data: groupGames } = await supabase.from("games").select("created_at, group_id").in("group_id", groupIds);
        allGroupGames = (groupGames ?? []) as { created_at: string; group_id: string | null }[];
      }
      const currentEntries: CurrentGameEntry[] = (placingGames ?? []).map((game) => ({
        game,
        groupName: game.group_id ? groupNames[game.group_id] ?? "—" : "—",
        streak: getGroupStreak(allGroupGames, game.group_id),
      }));
      setCurrentGames(currentEntries);

      const gamesMap = new Map((gamesData ?? []).map((g) => [g.id, g]));
      const pastGroupIds = [...new Set((gamesData ?? []).map((g) => (g as { group_id?: string | null }).group_id).filter(Boolean) as string[])];
      let pastGroupNames: Record<string, string> = {};
      if (pastGroupIds.length > 0) {
        const { data: grp } = await supabase.from("saved_groups").select("id, name").in("id", pastGroupIds);
        const { data: mems } = await supabase.from("group_members").select("group_id, display_name").in("group_id", pastGroupIds).order("sort_order", { ascending: true });
        const membersByGroup = new Map<string, string[]>();
        for (const m of mems ?? []) {
          const list = membersByGroup.get(m.group_id) ?? [];
          list.push(m.display_name);
          membersByGroup.set(m.group_id, list);
        }
        for (const g of grp ?? []) {
          pastGroupNames[g.id] = g.name && g.name.trim() !== "" ? g.name : (membersByGroup.get(g.id) ?? []).join(", ");
        }
      }
      let bestRankSoFar: number | null = null;
      const rankHistoryList: GameRankEntry[] = [];
      const candidateTagsList: CandidateTag[] = [];

      for (const slot of mySlots ?? []) {
        const game = gamesMap.get(slot.game_id);
        if (!game || slot.self_x == null || slot.self_y == null) continue;

        const { data: guessesForMe } = await supabase
          .from("guesses")
          .select("guess_x, guess_y")
          .eq("target_game_player_id", slot.id);

        const allPlayersInGame = await supabase
          .from("game_players")
          .select("id, score")
          .eq("game_id", slot.game_id)
          .not("score", "is", null);

        const sorted = (allPlayersInGame.data ?? []).slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const myIdx = sorted.findIndex((p) => p.id === slot.id);
        if (myIdx >= 0) {
          const rank = myIdx + 1;
          if (bestRankSoFar === null || rank < bestRankSoFar) bestRankSoFar = rank;
          const g = game as { group_id?: string | null };
          rankHistoryList.push({
            gameId: game.id,
            inviteCode: game.invite_code,
            axesLabel: `${game.axis_x_label_low}–${game.axis_x_label_high} / ${game.axis_y_label_low}–${game.axis_y_label_high}`,
            createdAt: game.created_at,
            myRank: rank,
            totalPlayers: sorted.length,
            groupName: g.group_id ? (pastGroupNames[g.group_id] ?? "—") : "—",
          });
        }

        if ((guessesForMe?.length ?? 0) >= 1 && game) {
          const xs = guessesForMe!.map((g) => g.guess_x);
          const ys = guessesForMe!.map((g) => g.guess_y);
          const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
          const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
          const pctHighX = Math.round(Math.min(100, Math.max(0, meanX * 100)));
          const pctLowX = Math.round(Math.min(100, Math.max(0, (1 - meanX) * 100)));
          const pctHighY = Math.round(Math.min(100, Math.max(0, meanY * 100)));
          const pctLowY = Math.round(Math.min(100, Math.max(0, (1 - meanY) * 100)));
          candidateTagsList.push(
            { label: game.axis_x_label_high, agreement_pct: pctHighX, game_id: game.id, source_axis: "x" },
            { label: game.axis_x_label_low, agreement_pct: pctLowX, game_id: game.id, source_axis: "x" },
            { label: game.axis_y_label_high, agreement_pct: pctHighY, game_id: game.id, source_axis: "y" },
            { label: game.axis_y_label_low, agreement_pct: pctLowY, game_id: game.id, source_axis: "y" },
          );
        }
      }

      // Dedupe by game and sort by date (newest first)
      const byGame = new Map(rankHistoryList.map((r) => [r.gameId, r]));
      const sorted = Array.from(byGame.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setScoreHistory(sorted.slice(0, 10));
      setGamesCount(gameIds.length);
      setBestRank(bestRankSoFar);
      const sortedCandidates = candidateTagsList
        .sort((a, b) => b.agreement_pct - a.agreement_pct)
        .slice(0, 30);
      setCandidateTags(sortedCandidates);
      setLoading(false);
    };

    run();
  }, [user, authLoading, isLinked, router]);

  const addFeaturedTag = async (tag: CandidateTag) => {
    if (!user) return;
    const supabase = createClient();
    const sortOrder = featuredTags.length;
    const { data } = await supabase
      .from("user_featured_tags")
      .insert({
        user_id: user.id,
        label: tag.label,
        agreement_pct: tag.agreement_pct,
        game_id: tag.game_id,
        source_axis: tag.source_axis,
        sort_order: sortOrder,
      })
      .select("id, label, agreement_pct, game_id, source_axis, sort_order")
      .single();
    if (data) setFeaturedTags((prev) => [...prev, data as FeaturedTag]);
    setShowAddTagModal(false);
  };

  const removeFeaturedTag = async (id: string) => {
    const supabase = createClient();
    await supabase.from("user_featured_tags").delete().eq("id", id);
    setFeaturedTags((prev) => prev.filter((t) => t.id !== id));
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (!isLinked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="text-center max-w-sm">
          <p className="text-foreground font-medium">
            You’re playing anonymously
          </p>
          <p className="mt-1 text-sm text-secondary">
            Create an account or link with email/Google to see your profile, save game history, and use groups. You can sign out from Settings (gear icon on your account page).
          </p>
        </div>
        <AccountPrompt />
        <Link href="/" className="text-sm text-splash hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12 font-sans">
      <div className="w-full max-w-lg flex justify-end -mt-2 mb-2">
        <Link
          href="/profile/settings"
          className="rounded-lg border border-surface-muted p-2 text-secondary hover:border-splash hover:text-splash transition-colors"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon className="h-5 w-5" />
        </Link>
      </div>
      <main className="w-full max-w-lg flex flex-col items-center gap-8">
        {loading ? (
          <p className="text-secondary">Loading...</p>
        ) : (
          <div className="w-full rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-black">
                {displayName ?? "Account"}
              </h1>
              <p className="text-sm text-secondary">
                {user?.email ?? "Signed in"}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
                {featuredTags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full bg-surface border border-surface-muted px-3 py-1 text-sm text-black"
                  >
                    {t.label} {t.agreement_pct}%
                    <button
                      type="button"
                      onClick={() => removeFeaturedTag(t.id)}
                      className="ml-0.5 rounded p-0.5 hover:bg-surface-muted"
                      aria-label={`Remove ${t.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddTagModal(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-surface-muted text-secondary hover:bg-surface-muted hover:text-black transition-colors"
                  aria-label="Add tag"
                >
                  +
                </button>
            </div>

            {showAddTagModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
                <div className="max-h-[70vh] w-full max-w-sm overflow-auto rounded-xl border border-surface-muted bg-white p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-black">Add tag from past games</h3>
                    <p className="text-sm text-secondary">Pick a tag to feature.</p>
                  <ul className="mt-4 space-y-1">
                    {candidateTags
                      .filter((c) => !featuredTags.some((f) => f.label === c.label && f.game_id === c.game_id))
                      .slice(0, 20)
                      .map((c, i) => (
                        <li key={`${c.game_id}-${c.label}-${c.source_axis}-${i}`}>
                          <button
                            type="button"
                            onClick={() => addFeaturedTag(c)}
                            className="w-full rounded-lg border border-surface-muted bg-surface px-3 py-2 text-left text-sm text-black hover:bg-surface-muted transition-colors"
                          >
                            {c.label} {c.agreement_pct}%
                          </button>
                        </li>
                      ))}
                  </ul>
                  {candidateTags.filter((c) => !featuredTags.some((f) => f.label === c.label && f.game_id === c.game_id)).length === 0 && (
                    <p className="mt-4 text-sm text-secondary">No more tags to add from past games.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAddTagModal(false)}
                    className="mt-4 w-full rounded-lg border border-surface-muted bg-surface px-4 py-2 text-sm font-medium text-black hover:bg-surface-muted transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            <section className="flex flex-col gap-2 items-center">
              <h2 className="text-lg font-semibold text-black">
                Current games
              </h2>
              {currentGames.length === 0 ? (
                <p className="text-sm text-secondary">
                  No active games. Start or join a game to see it here.
                </p>
              ) : (
                <div className="overflow-x-auto overflow-y-hidden pb-2 -mx-2 w-full flex justify-center">
                  <div className="flex flex-col gap-3 min-w-max w-max">
                    <div className="flex gap-3">
                      {currentGames.filter((_, i) => i % 2 === 0).map((entry) => (
                      <Link
                        key={entry.game.id}
                        href={`/play/${entry.game.invite_code}`}
                        className="block w-48 shrink-0 rounded-lg border border-surface-muted bg-surface p-3 text-black hover:bg-surface-muted transition-colors"
                      >
                        <div className="text-sm font-medium truncate">
                          {entry.game.axis_x_label_low}–{entry.game.axis_x_label_high}
                        </div>
                        <div className="text-xs text-secondary truncate mt-0.5">
                          {entry.game.axis_y_label_low}–{entry.game.axis_y_label_high}
                        </div>
                        <div className="text-xs text-secondary mt-1 truncate" title={entry.groupName}>
                          {entry.groupName || "—"}
                        </div>
                        {entry.streak > 0 && (
                          <div className="text-xs text-splash mt-0.5">
                            {entry.streak}-day streak
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    {currentGames.filter((_, i) => i % 2 === 1).map((entry) => (
                      <Link
                        key={entry.game.id}
                        href={`/play/${entry.game.invite_code}`}
                        className="block w-48 shrink-0 rounded-lg border border-surface-muted bg-surface p-3 text-black hover:bg-surface-muted transition-colors"
                      >
                        <div className="text-sm font-medium truncate">
                          {entry.game.axis_x_label_low}–{entry.game.axis_x_label_high}
                        </div>
                        <div className="text-xs text-secondary truncate mt-0.5">
                          {entry.game.axis_y_label_low}–{entry.game.axis_y_label_high}
                        </div>
                        <div className="text-xs text-secondary mt-1 truncate" title={entry.groupName}>
                          {entry.groupName || "—"}
                        </div>
                        {entry.streak > 0 && (
                          <div className="text-xs text-splash mt-0.5">
                            {entry.streak}-day streak
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2 items-center">
              <h2 className="text-lg font-semibold text-black">
                Past games
              </h2>
              {scoreHistory.length === 0 ? (
                <p className="text-sm text-secondary">
                  No games yet. Play a game and come back after it ends.
                </p>
              ) : (
                <div className="overflow-x-auto overflow-y-hidden pb-2 -mx-2 w-full flex justify-center">
                  <div className="flex flex-col gap-3 min-w-max w-max">
                    <div className="flex gap-3">
                      {scoreHistory.filter((_, i) => i % 2 === 0).map((entry) => (
                        <Link
                          key={entry.gameId}
                          href={`/play/${entry.inviteCode}`}
                          className="block w-48 shrink-0 rounded-lg border border-surface-muted bg-surface p-3 text-black hover:bg-surface-muted transition-colors"
                        >
                          <div className="text-sm font-medium truncate">
                            {entry.axesLabel}
                          </div>
                          <div className="text-xs text-secondary mt-0.5 truncate">
                            {entry.groupName || "—"}
                          </div>
                          <div className="text-xs text-secondary mt-1">
                            You placed {entry.myRank}{getRankSuffix(entry.myRank)} of {entry.totalPlayers}
                          </div>
                          <div className="text-xs text-secondary mt-0.5">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      {scoreHistory.filter((_, i) => i % 2 === 1).map((entry) => (
                        <Link
                          key={entry.gameId}
                          href={`/play/${entry.inviteCode}`}
                          className="block w-48 shrink-0 rounded-lg border border-surface-muted bg-surface p-3 text-black hover:bg-surface-muted transition-colors"
                        >
                          <div className="text-sm font-medium truncate">
                            {entry.axesLabel}
                          </div>
                          <div className="text-xs text-secondary mt-0.5 truncate">
                            {entry.groupName || "—"}
                          </div>
                          <div className="text-xs text-secondary mt-1">
                            You placed {entry.myRank}{getRankSuffix(entry.myRank)} of {entry.totalPlayers}
                          </div>
                          <div className="text-xs text-secondary mt-0.5">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

        </div>
      )}
      </main>
    </div>
  );
}

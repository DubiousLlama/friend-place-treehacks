"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AccountPrompt } from "./AccountPrompt";
import type { Database } from "@/lib/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];

function getRankSuffix(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

interface GameResultsViewProps {
  game: Game;
  gamePlayers: GamePlayer[];
  inviteCode: string;
  currentPlayerId: string | null;
}

export function GameResultsView({
  game,
  gamePlayers,
  inviteCode,
  currentPlayerId,
}: GameResultsViewProps) {
  const { isLinked } = useAuth();
  const [savingGroup, setSavingGroup] = useState(false);
  const [saveGroupName, setSaveGroupName] = useState("");
  const [showSaveGroup, setShowSaveGroup] = useState(false);

  const withScores = gamePlayers
    .filter((gp) => gp.score != null)
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const mySlot = gamePlayers.find((gp) => gp.player_id === currentPlayerId);
  const myRank =
    mySlot != null && mySlot.score != null
      ? withScores.findIndex((gp) => gp.id === mySlot.id) + 1
      : null;

  const handleSaveGroup = async () => {
    const name = saveGroupName.trim();
    if (!name || !currentPlayerId) return;
    setSavingGroup(true);
    const supabase = createClient();
    const { data: group, error: groupErr } = await supabase
      .from("saved_groups")
      .insert({ owner_id: currentPlayerId, name })
      .select("id")
      .single();
    if (groupErr || !group) {
      setSavingGroup(false);
      return;
    }
    // Insert owner as first group_member, then others (match ResultsView / group_members model)
    const mySlot = gamePlayers.find((p) => p.player_id === currentPlayerId);
    await supabase.from("group_members").insert({
      group_id: group.id,
      player_id: currentPlayerId,
      is_anonymous: false,
      sort_order: 0,
    });
    let sortOrder = 1;
    for (const gp of gamePlayers) {
      if (gp.player_id === currentPlayerId) continue;
      await supabase.from("group_members").insert({
        group_id: group.id,
        player_id: gp.player_id ?? null,
        anonymous_display_name: gp.player_id == null ? gp.display_name : null,
        is_anonymous: gp.player_id == null,
        sort_order: sortOrder++,
      });
    }
    setSavingGroup(false);
    setShowSaveGroup(false);
    setSaveGroupName("");
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Results
        </h1>
        <p className="mt-1 text-sm text-secondary">
          {game.axis_x_label_low} vs {game.axis_x_label_high} ·{" "}
          {game.axis_y_label_low} vs {game.axis_y_label_high}
        </p>

        <section className="mt-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Rankings
          </h2>
          <ul className="mt-2 space-y-1.5">
            {withScores.map((gp, idx) => {
              const rank = idx + 1;
              const isYou = gp.player_id === currentPlayerId;
              return (
                <li
                  key={gp.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${isYou ? "bg-splash/10 font-medium" : "bg-muted/30"}`}
                >
                  <span className="text-foreground">
                    {rank}
                    {getRankSuffix(rank)} {gp.display_name}
                    {isYou ? " (you)" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          {myRank != null && (
            <p className="mt-3 text-sm text-secondary">
              You came {myRank}
              {getRankSuffix(myRank)} of {withScores.length}.
            </p>
          )}
        </section>

        {isLinked && (
          <section className="mt-6">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Save this group
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Start another game later with the same friends in one tap.
            </p>
            {!showSaveGroup ? (
              <button
                type="button"
                onClick={() => setShowSaveGroup(true)}
                className="mt-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Save as group
              </button>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={saveGroupName}
                  onChange={(e) => setSaveGroupName(e.target.value)}
                  placeholder="e.g. Roommates"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveGroup}
                  disabled={savingGroup || !saveGroupName.trim()}
                  className="rounded-lg bg-splash px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {savingGroup ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </section>
        )}

        {!isLinked && (
          <section className="mt-6">
            <AccountPrompt />
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-splash px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Create another game
          </Link>
          <Link
            href="/profile"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            My profile
          </Link>
        </div>
      </div>
    </div>
  );
}

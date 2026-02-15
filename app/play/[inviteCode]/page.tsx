"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { NameSelector } from "@/components/NameSelector";
import { GameDashboard } from "@/components/GameDashboard";
import { PlacingPhase } from "@/components/PlacingPhase";
import { GameInfoPanel } from "@/components/GameInfoPanel";
import { ResultsView } from "@/components/ResultsView";
import { AuthModal } from "@/components/AuthModal";
import type { Database } from "@/lib/types/database";
import type { Position } from "@/lib/game-types";
import { useIsMobile } from "@/hooks/useIsMobile";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];
type Guess = Database["public"]["Tables"]["guesses"]["Row"];

/** Pending invite from API (masked email only) */
type PendingInvite = { id: string; masked_email: string; invited_by: string; expires_at: string };

export default function PlayPage() {
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  const [game, setGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [pendingGameInvites, setPendingGameInvites] = useState<PendingInvite[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Existing guesses by the current user (to know which friends are already placed)
  const [myGuesses, setMyGuesses] = useState<Guess[]>([]);

  // When game is missing: "deleted" | "not_found" (null when we have a game)
  const [notFoundReason, setNotFoundReason] = useState<"deleted" | "not_found" | null>(null);

  // View mode: "graph" or "dashboard"
  const [view, setView] = useState<"graph" | "dashboard">("graph");

  // When true, NameSelector is shown in "switch" mode (current data preserved)
  const [switchingIdentity, setSwitchingIdentity] = useState(false);

  // Claim-by-token flow (email invite: set display name then claim reserved slot)
  const searchParams = useSearchParams();
  const claimToken = searchParams.get("claim");
  const [claimName, setClaimName] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showClaimAuthModal, setShowClaimAuthModal] = useState(false);

  const isMobile = useIsMobile();
  const router = useRouter();
  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    // Ensure session
    let {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const { data: anon } = await supabase.auth.signInAnonymously();
      user = anon?.user ?? null;
    }
    if (!user) {
      setLoading(false);
      return;
    }
    setCurrentPlayerId(user.id);

    // Fetch game
    const { data: rawGame, error: gameErr } = await supabase
      .from("games")
      .select("*")
      .eq("invite_code", inviteCode)
      .single();

    if (gameErr || !rawGame) {
      setGame(null);
      try {
        const res = await fetch(`/api/games/by-invite/${encodeURIComponent(inviteCode)}`);
        const body = await res.json();
        setNotFoundReason(body.status === "deleted" ? "deleted" : "not_found");
      } catch {
        setNotFoundReason("not_found");
      }
      setLoading(false);
      return;
    }
    setNotFoundReason(null);
    const gameData = rawGame as Game;
    setGame(gameData);

    // Fetch game players
    const { data: players } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameData.id)
      .order("claimed_at", { ascending: true, nullsFirst: false });

    const playerList = (players as GamePlayer[]) ?? [];
    setGamePlayers(playerList);

    const invitesRes = await fetch(`/api/games/${gameData.id}/invites`);
    if (invitesRes.ok) {
      const { invites: list } = await invitesRes.json();
      setPendingGameInvites(list ?? []);
    } else {
      setPendingGameInvites([]);
    }

    // Find the current user's slot
    const mySlot = playerList.find((gp) => gp.player_id === user!.id);

    // Fetch existing guesses by this user
    if (mySlot) {
      const { data: guesses } = await supabase
        .from("guesses")
        .select("*")
        .eq("game_id", gameData.id)
        .eq("guesser_game_player_id", mySlot.id);

      setMyGuesses((guesses as Guess[]) ?? []);
    }

    setLoading(false);
  }, [inviteCode, supabase]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Prefill display name from invite when claim token is present (inviter-set suggested name)
  useEffect(() => {
    if (!claimToken) return;
    fetch(`/api/join?token=${encodeURIComponent(claimToken)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { suggested_display_name?: string } | null) => {
        if (data?.suggested_display_name?.trim()) {
          setClaimName(data.suggested_display_name.trim());
        }
      })
      .catch(() => {});
  }, [claimToken]);

  // Realtime: game_players changes
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`play-players-${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${game.id}`,
        },
        async () => {
          const [playersRes, invitesRes] = await Promise.all([
            supabase
              .from("game_players")
              .select("*")
              .eq("game_id", game.id)
              .order("claimed_at", { ascending: true, nullsFirst: false }),
            fetch(`/api/games/${game.id}/invites`),
          ]);
          if (playersRes.data) setGamePlayers(playersRes.data as GamePlayer[]);
          if (invitesRes.ok) {
            const { invites: list } = await invitesRes.json();
            setPendingGameInvites(list ?? []);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, supabase]);

  // Check for time-based game ending on load
  // If the deadline has passed and the game is still in "placing", trigger check-end.
  useEffect(() => {
    if (!game?.id || game.phase !== "placing") return;
    if (!game.submissions_lock_at) return;

    const deadline = new Date(game.submissions_lock_at);
    if (deadline <= new Date()) {
      supabase.rpc("check_and_end_game", { p_game_id: game.id }).then(() => {
        // Non-critical — Realtime will catch phase changes
      });
    }
  }, [game?.id, game?.phase, game?.submissions_lock_at, supabase]);

  // Realtime: game phase changes
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`play-game-${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${game.id}`,
        },
        (payload) => {
          setGame(payload.new as Game);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, supabase]);

  // ---- Submit handler: writes placements to Supabase ----
  //
  // Uses delete + re-insert so moved tokens are updated and new ones are saved.

  const handleSubmitPlacements = useCallback(
    async (
      selfPosition: Position,
      guesses: { targetGamePlayerId: string; position: Position }[]
    ) => {
      if (!game || !currentPlayerId) return;

      const mySlot = gamePlayers.find(
        (gp) => gp.player_id === currentPlayerId
      );
      if (!mySlot) return;

      // 1. Update self placement
      const { error: selfErr } = await supabase
        .from("game_players")
        .update({
          self_x: selfPosition.x,
          self_y: selfPosition.y,
          has_submitted: true,
        })
        .eq("id", mySlot.id);

      if (selfErr) console.error("Failed to update self placement:", selfErr);

      // 2. Delete all existing guesses by this user for this game
      const { error: delErr } = await supabase
        .from("guesses")
        .delete()
        .eq("game_id", game.id)
        .eq("guesser_game_player_id", mySlot.id);

      if (delErr) console.error("Failed to delete old guesses:", delErr);

      // 3. Re-insert all current guesses (both previously placed + newly placed)
      if (guesses.length > 0) {
        const { error: insErr } = await supabase.from("guesses").insert(
          guesses.map((g) => ({
            game_id: game.id,
            guesser_game_player_id: mySlot.id,
            target_game_player_id: g.targetGamePlayerId,
            guess_x: g.position.x,
            guess_y: g.position.y,
          }))
        );

        if (insErr) console.error("Failed to insert guesses:", insErr);
      }

      // 4. Check if game should end (early-end or time-based)
      try {
        const { error: rpcErr } = await supabase.rpc("check_and_end_game", { p_game_id: game.id });
        if (rpcErr) console.error("check_and_end_game RPC error:", rpcErr);
      } catch (checkEndErr) {
        /* ignore */
      }

      // 5. Refresh data and switch to dashboard
      await fetchAll();
      setView("dashboard");
    },
    [game, currentPlayerId, gamePlayers, supabase, fetchAll]
  );

  // ---- End game handler: host transitions to results phase ----
  // Uses the check_and_end_game RPC with force=true so scores are computed.

  const handleEndGame = useCallback(async () => {
    if (!game || !currentPlayerId) return;
    if (game.created_by !== currentPlayerId) return;

    try {
      const { data, error } = await supabase.rpc("check_and_end_game", {
        p_game_id: game.id,
        p_force: true,
      });

      if (error) {
        console.error("Failed to end game:", error);
      } else {
        // Award consensus tags (idempotent); fire-and-forget
        if ((data as { ended?: boolean } | null)?.ended) {
          fetch(`/api/games/${game.id}/award-tags`, { method: "POST" }).catch(() => {});
        }
        // Realtime subscription will update the game state automatically,
        // but also refresh to be safe
        await fetchAll();
      }
    } catch (err) {
      console.error("Failed to end game:", err);
    }
  }, [game, currentPlayerId, supabase, fetchAll]);

  // ---- Delete game: host only; then redirect to games list ----
  const handleDeleteGame = useCallback(async () => {
    if (!game || !currentPlayerId || game.created_by !== currentPlayerId) return;
    try {
      const res = await fetch(`/api/games/${game.id}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error ?? "Failed to delete game");
      }
      router.push(currentPlayerId ? "/profile" : "/");
    } catch (err) {
      console.error("Delete game:", err);
      window.alert(err instanceof Error ? err.message : "Failed to delete game");
    }
  }, [game, currentPlayerId, router]);

  // ---- Edit display name: same slot, update label only ----

  const handleEditDisplayName = useCallback(
    async (newName: string) => {
      const trimmed = newName.trim();
      if (!game || !currentPlayerId || !trimmed) return;

      const mySlot = gamePlayers.find(
        (gp) => gp.player_id === currentPlayerId
      );
      if (!mySlot) return;

      const { error } = await supabase
        .from("game_players")
        .update({ display_name: trimmed })
        .eq("id", mySlot.id);

      if (error) {
        if (error.code === "23505") {
          throw new Error("That name is already in the game.");
        }
        throw new Error("Failed to update name.");
      }
      await fetchAll();
    },
    [game, currentPlayerId, gamePlayers, supabase, fetchAll]
  );

  // Is the current user the game host?
  const isHost = game?.created_by === currentPlayerId;

  // ---- Render states ----

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-secondary">Loading...</p>
      </div>
    );
  }

  if (!game) {
    const isDeleted = notFoundReason === "deleted";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold text-foreground">
          {isDeleted ? "This game has been deleted" : "Game not found"}
        </h1>
        <p className="text-secondary text-center max-w-sm">
          {isDeleted
            ? "The host has deleted this game. The invite link no longer works."
            : "This invite link may be wrong or the game may have been deleted."}
        </p>
        <a
          href={currentPlayerId ? "/profile" : "/"}
          className="rounded-lg bg-splash text-white px-4 py-2 font-medium"
        >
          {currentPlayerId ? "Back to profile" : "Back home"}
        </a>
      </div>
    );
  }

  // Has the current user claimed a name slot?
  const mySlot = gamePlayers.find(
    (gp) => gp.player_id === currentPlayerId
  );

  // Email-invite claim flow: ?claim=TOKEN → prompt for display name, then POST /api/join
  if (claimToken && game && currentPlayerId) {
    const handleClaimSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const name = claimName.trim();
      if (!name) return;
      setClaimSubmitting(true);
      setClaimError(null);
      try {
        const res = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: claimToken, displayName: name }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setShowClaimAuthModal(true);
          setClaimSubmitting(false);
          return;
        }
        if (res.status === 404 || res.status === 410) {
          setClaimError("Invite not found or expired.");
          return;
        }
        if (!res.ok) {
          setClaimError(data.error ?? "Something went wrong");
          return;
        }
        if (data.redirect) {
          router.replace(data.redirect);
          return;
        }
        setClaimError("Invalid response");
      } finally {
        setClaimSubmitting(false);
      }
    };

    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-surface-muted bg-white p-6 flex flex-col gap-5">
          <div>
            <h1 className="text-xl font-semibold text-black mb-1">
              You&apos;re invited to this game
            </h1>
            <p className="text-sm text-secondary">
              Choose your display name to join.
            </p>
          </div>
          <form onSubmit={handleClaimSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={claimName}
              onChange={(e) => setClaimName(e.target.value)}
              placeholder="Display name"
              maxLength={50}
              className="rounded-lg border border-surface-muted bg-surface px-3 py-2 text-sm text-black placeholder:text-secondary"
              autoFocus
            />
            {claimError && (
              <p className="text-sm text-red-600">{claimError}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={claimSubmitting || !claimName.trim()}
                className="rounded-lg bg-splash text-white px-4 py-2 font-medium disabled:opacity-50"
              >
                {claimSubmitting ? "Joining…" : "Continue"}
              </button>
              {claimError && (
                <Link
                  href={`/play/${inviteCode}`}
                  className="text-center text-sm text-splash hover:underline"
                >
                  Open game without invite
                </Link>
              )}
            </div>
          </form>
        </div>
        {showClaimAuthModal && (
          <AuthModal
            returnPath={`/play/${inviteCode}?claim=${encodeURIComponent(claimToken)}`}
            onClose={() => setShowClaimAuthModal(false)}
            onSuccess={() => setShowClaimAuthModal(false)}
          />
        )}
      </div>
    );
  }

  // Not claimed yet, or actively switching identity — show NameSelector
  if (!mySlot || switchingIdentity) {
    return (
      <NameSelector
        gameId={game.id}
        gamePlayers={gamePlayers}
        currentPlayerId={currentPlayerId!}
        onClaimed={() => {
          setSwitchingIdentity(false);
          setMyGuesses([]);
          fetchAll();
        }}
        currentSlotId={switchingIdentity && mySlot ? mySlot.id : undefined}
        onCancel={() => setSwitchingIdentity(false)}
      />
    );
  }

  // Game is in results phase
  if (game.phase === "results") {
    return (
      <ResultsView
        game={game}
        gamePlayers={gamePlayers}
        currentPlayerId={currentPlayerId!}
      />
    );
  }

  // ---- Placing phase ----

  // All friends (everyone except current user)
  const allFriends = gamePlayers.filter((gp) => gp.id !== mySlot.id);

  // Build initial positions map from existing guesses
  const initialOtherPositions = new Map<string, Position>();
  for (const g of myGuesses) {
    initialOtherPositions.set(g.target_game_player_id, {
      x: g.guess_x,
      y: g.guess_y,
    });
  }

  // Pre-existing self position (for re-entry)
  const existingSelfPosition: Position | null =
    mySlot.self_x != null && mySlot.self_y != null
      ? { x: mySlot.self_x, y: mySlot.self_y }
      : null;

  const guessedCount = myGuesses.length;

  // Graph view: first visit starts here; returning users can get here via
  // "Continue placing" from the dashboard.
  if (view === "graph") {
    const gameInfoPanel = (
      <GameInfoPanel
        game={game}
        gamePlayers={gamePlayers}
        mySlot={mySlot}
        inviteCode={inviteCode}
        guessedCount={guessedCount}
        onUnclaim={() => setSwitchingIdentity(true)}
        onEditName={handleEditDisplayName}
        isHost={isHost}
        onEndGame={handleEndGame}
        onDeleteGame={handleDeleteGame}
        variant={isMobile ? "dropdown" : "sidebar"}
      />
    );

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-surface overflow-y-auto">
        {/* Graph placing experience — fills available space */}
        <div className="flex-1 min-h-[85dvh]">
          <PlacingPhase
            game={game}
            currentGamePlayerId={mySlot.id}
            currentDisplayName={mySlot.display_name}
            otherPlayers={allFriends}
            initialSelfPosition={existingSelfPosition}
            initialOtherPositions={initialOtherPositions}
            onSubmit={handleSubmitPlacements}
            sidebarContent={gameInfoPanel}
          />
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="min-h-screen py-10 px-4 bg-surface">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground font-display">
          Friend Place
        </h1>
        <p className="text-sm text-secondary mt-1">
          {game.axis_x_label_low} vs. {game.axis_x_label_high} &nbsp;|&nbsp;{" "}
          {game.axis_y_label_low} vs. {game.axis_y_label_high}
        </p>
      </div>
      <GameDashboard
        game={game}
        gamePlayers={gamePlayers}
        mySlot={mySlot}
        currentPlayerId={currentPlayerId!}
        inviteCode={inviteCode}
        guessedCount={guessedCount}
        onContinuePlacing={() => {
          setView("graph");
        }}
        onPlayersChanged={() => {
          fetchAll();
        }}
        onUnclaim={() => setSwitchingIdentity(true)}
        onEditName={handleEditDisplayName}
        isHost={isHost}
        onEndGame={handleEndGame}
        onDeleteGame={handleDeleteGame}
        pendingInvites={pendingGameInvites.map((inv) => ({ id: inv.id, email: inv.masked_email }))}
      />
    </div>
  );
}

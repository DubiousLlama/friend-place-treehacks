"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NameSelector } from "@/components/NameSelector";
import { GameDashboard } from "@/components/GameDashboard";
import { PlacingPhase } from "@/components/PlacingPhase";
import { GameInfoPanel } from "@/components/GameInfoPanel";
import { ResultsView } from "@/components/ResultsView";
import type { Database } from "@/lib/types/database";
import type { Position } from "@/lib/game-types";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/lib/use-auth";
import { OnboardingInstructionModal } from "@/components/OnboardingInstructionModal";

type Game = Database["public"]["Tables"]["games"]["Row"];
type GamePlayer = Database["public"]["Tables"]["game_players"]["Row"];
type Guess = Database["public"]["Tables"]["guesses"]["Row"];

export default function PlayPage() {
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  const [game, setGame] = useState<Game | null>(null);
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Existing guesses by the current user (to know which friends are already placed)
  const [myGuesses, setMyGuesses] = useState<Guess[]>([]);

  // View mode: "graph" or "dashboard"
  const [view, setView] = useState<"graph" | "dashboard">("graph");

  // Placing step: "self" (place yourself) or "others" (place friends). Used so popup 2 only shows when it's time to place friends.
  const [placingStep, setPlacingStep] = useState<"self" | "others">("self");

  // When true, NameSelector is shown in "switch" mode (current data preserved)
  const [switchingIdentity, setSwitchingIdentity] = useState(false);

  const isMobile = useIsMobile();
  const { isLinked } = useAuth();
  const supabase = createClient();

  // mySlot: current user's game_players row (defined early so onboarding effect can use it)
  const mySlot =
    game && currentPlayerId
      ? gamePlayers.find((gp) => gp.player_id === currentPlayerId) ?? null
      : null;

  // Onboarding: show instruction popup first two times in placing phase (account overrides localStorage)
  const ONBOARDING_KEY = "fp-onboarding-plays-seen";
  const [onboardingCount, setOnboardingCount] = useState<number | null>(null);
  useEffect(() => {
    if (!game || game.phase !== "placing" || !mySlot) return;
    let cancelled = false;
    if (isLinked) {
      fetch("/api/onboarding/count")
        .then((res) => (res.ok ? res.json() : { count: 0 }))
        .then((data: { count: number }) => {
          if (!cancelled) setOnboardingCount(data.count ?? 0);
        })
        .catch(() => {
          if (!cancelled) setOnboardingCount(0);
        });
    } else {
      const raw = typeof window !== "undefined" ? localStorage.getItem(ONBOARDING_KEY) : null;
      const n = raw !== null ? parseInt(raw, 10) : 0;
      if (!cancelled) setOnboardingCount(Number.isNaN(n) ? 0 : Math.min(Math.max(0, n), 2));
    }
    return () => {
      cancelled = true;
    };
  }, [game?.id, game?.phase, mySlot?.id, isLinked]);

  const handleOnboardingDismiss = useCallback(async () => {
    const next = onboardingCount === null ? 2 : Math.min(onboardingCount + 1, 2);
    setOnboardingCount(next);
    if (isLinked) {
      await fetch("/api/onboarding/seen", { method: "POST" });
    } else if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_KEY, String(next));
    }
  }, [onboardingCount, isLinked]);

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
      setLoading(false);
      return;
    }
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
        () => {
          supabase
            .from("game_players")
            .select("*")
            .eq("game_id", game.id)
            .order("claimed_at", { ascending: true, nullsFirst: false })
            .then(({ data }) => {
              if (data) setGamePlayers(data as GamePlayer[]);
            });
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

      // 1. Update self placement and denormalized guesses count (so others see x/n placed)
      const { error: selfErr } = await supabase
        .from("game_players")
        .update({
          self_x: selfPosition.x,
          self_y: selfPosition.y,
          has_submitted: true,
          guesses_count: guesses.length,
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
      const { error: rpcErr } = await supabase.rpc("check_and_end_game", { p_game_id: game.id });
      if (rpcErr) console.error("check_and_end_game RPC error:", rpcErr);

      // 5. Refresh data and switch to dashboard
      await fetchAll();
      setView("dashboard");
    },
    [game, currentPlayerId, gamePlayers, supabase, fetchAll]
  );

  // ---- End game handler: host transitions to results phase ----
  // Uses the check_and_end_game RPC with force=true to transition to results.
  // Scores are computed client-side from lib/scoring when viewing results.

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
        // Realtime subscription will update the game state automatically,
        // but also refresh to be safe
        await fetchAll();
      }
    } catch (err) {
      console.error("Failed to end game:", err);
    }
  }, [game, currentPlayerId, supabase, fetchAll]);

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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-xl font-semibold text-foreground">
          Game not found
        </h1>
        <p className="text-secondary text-center max-w-sm">
          This invite link may be wrong or the game may have been deleted.
        </p>
        <a
          href="/"
          className="rounded-lg bg-splash text-white px-4 py-2 font-medium"
        >
          Back home
        </a>
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

  // Popup 1: when first time (count 0). Popup 2: only when count 1 and user has placed self (step "others").
  const onboardingVariant =
    onboardingCount === 0
      ? 1
      : onboardingCount === 1 && view === "graph" && placingStep === "others"
        ? 2
        : null;

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
        variant={isMobile ? "dropdown" : "sidebar"}
      />
    );

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-surface overflow-y-auto">
        {onboardingVariant && (
          <OnboardingInstructionModal
            variant={onboardingVariant}
            onDismiss={handleOnboardingDismiss}
          />
        )}
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
            onStepChange={setPlacingStep}
          />
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="min-h-screen py-10 px-4 bg-surface">
      {onboardingVariant && (
        <OnboardingInstructionModal
          variant={onboardingVariant}
          onDismiss={handleOnboardingDismiss}
        />
      )}
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
      />
    </div>
  );
}

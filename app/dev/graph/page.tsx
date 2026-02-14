"use client";

import { useState, useCallback } from "react";
import { PlacingPhase } from "@/components/PlacingPhase";
import type { Game, GamePlayer, Position } from "@/lib/game-types";

// --- Mock data ---

const MOCK_GAME: Game = {
  id: "mock-game-id",
  invite_code: "ABC123",
  axis_x_label_low: "Early Bird",
  axis_x_label_high: "Night Owl",
  axis_y_label_low: "Introvert",
  axis_y_label_high: "Extrovert",
  phase: "placing",
  created_by: "mock-player-1",
  created_at: new Date().toISOString(),
  submissions_lock_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  end_early_when_complete: true,
};

const MOCK_GAME_LONG_LABELS: Game = {
  ...MOCK_GAME,
  id: "mock-game-long",
  axis_x_label_low: "Pineapple on pizza is delicious",
  axis_x_label_high: "Pineapple on pizza is a crime",
  axis_y_label_low: "Prefers staying home on a Friday",
  axis_y_label_high: "Always out on a Friday night",
};

/** The current user's game_players.id (their claimed slot) */
const CURRENT_GAME_PLAYER_ID = "gp-1";

const MOCK_OTHER_PLAYERS: GamePlayer[] = [
  {
    id: "gp-2",
    game_id: "mock-game-id",
    player_id: "p2",
    display_name: "Alice",
    self_x: null,
    self_y: null,
    has_submitted: false,
    score: null,
    claimed_at: new Date().toISOString(),
  },
  {
    id: "gp-3",
    game_id: "mock-game-id",
    player_id: "p3",
    display_name: "Bob",
    self_x: null,
    self_y: null,
    has_submitted: false,
    score: null,
    claimed_at: null,
  },
  {
    id: "gp-4",
    game_id: "mock-game-id",
    player_id: null,
    display_name: "Charlie",
    self_x: null,
    self_y: null,
    has_submitted: false,
    score: null,
    claimed_at: null,
  },
  {
    id: "gp-5",
    game_id: "mock-game-id",
    player_id: "p5",
    display_name: "Diana",
    self_x: null,
    self_y: null,
    has_submitted: false,
    score: null,
    claimed_at: new Date().toISOString(),
  },
  {
    id: "gp-6",
    game_id: "mock-game-id",
    player_id: null,
    display_name: "Evangeline",
    self_x: null,
    self_y: null,
    has_submitted: false,
    score: null,
    claimed_at: null,
  },
];

// --- Dev harness ---

export default function GraphDevPage() {
  const [key, setKey] = useState(0);
  const [useLongLabels, setUseLongLabels] = useState(false);
  const [submitted, setSubmitted] = useState<{
    selfPosition: Position;
    guesses: { targetGamePlayerId: string; position: Position }[];
  } | null>(null);

  const handleSubmit = useCallback(
    (selfPosition: Position, guesses: { targetGamePlayerId: string; position: Position }[]) => {
      console.log("Submit!", { selfPosition, guesses });
      setSubmitted({ selfPosition, guesses });
    },
    []
  );

  const handleReset = useCallback(() => {
    setKey((k) => k + 1);
    setSubmitted(null);
  }, []);

  const game = useLongLabels ? MOCK_GAME_LONG_LABELS : MOCK_GAME;

  return (
    <div className="h-dvh flex flex-col bg-surface">
      {/* Dev toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-secondary/10 shrink-0">
        <span className="font-display font-bold text-sm text-foreground">
          Dev: Graph
        </span>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs font-body text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={useLongLabels}
            onChange={(e) => {
              setUseLongLabels(e.target.checked);
              handleReset();
            }}
            className="rounded"
          />
          Long labels
        </label>
        <button
          onClick={handleReset}
          className="px-3 py-1 rounded-lg bg-splash text-white text-xs font-display font-bold"
        >
          Reset
        </button>
      </div>

      {/* Main content */}
      {submitted ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
          <h2 className="font-display font-bold text-xl text-foreground">
            Submitted!
          </h2>
          <pre className="bg-white rounded-xl p-4 text-xs font-mono text-foreground overflow-auto max-w-full max-h-[50vh] shadow-sm border border-secondary/10">
            {JSON.stringify(submitted, null, 2)}
          </pre>
          <button
            onClick={handleReset}
            className="px-6 py-2 rounded-xl bg-splash text-white font-display font-bold"
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <PlacingPhase
            key={key}
            game={game}
            currentGamePlayerId={CURRENT_GAME_PLAYER_ID}
            otherPlayers={MOCK_OTHER_PLAYERS}
            onSubmit={handleSubmit}
          />
        </div>
      )}
    </div>
  );
}

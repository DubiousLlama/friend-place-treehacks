"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { Game, GamePlayer, Position, NamePlacement } from "@/lib/game-types";
import { GameGraph } from "@/components/GameGraph";
import { PlayerToken } from "@/components/PlayerToken";
import { TokenTray } from "@/components/TokenTray";
import { computeLabelAnchors } from "@/lib/label-placement";
import { tapScale, hoverLift, springTransition } from "@/lib/motion";

interface PlacingPhaseProps {
  game: Game;
  /** The game_players.id of the current user's claimed slot */
  currentGamePlayerId: string;
  /** ALL other players in the game (including previously guessed ones) */
  otherPlayers: GamePlayer[];
  /** Pre-existing self position (when re-entering after a previous submit) */
  initialSelfPosition?: Position | null;
  /** Pre-existing guess positions keyed by game_player id (from previous submits) */
  initialOtherPositions?: Map<string, Position>;
  onSubmit: (
    selfPosition: Position,
    guesses: { targetGamePlayerId: string; position: Position }[]
  ) => void;
}

type Step = "self" | "others";

export function PlacingPhase({
  game,
  currentGamePlayerId,
  otherPlayers,
  initialSelfPosition = null,
  initialOtherPositions,
  onSubmit,
}: PlacingPhaseProps) {
  const graphRef = useRef<HTMLDivElement | null>(null);

  // If re-entering with an existing self position, start on step "others"
  const [step, setStep] = useState<Step>(
    initialSelfPosition ? "others" : "self"
  );
  const [selfPosition, setSelfPosition] = useState<Position | null>(
    initialSelfPosition
  );
  const [selfVersion, setSelfVersion] = useState(0);

  // Initialize other positions: pre-populate from DB for previously guessed friends
  const [otherPositions, setOtherPositions] = useState<Map<string, Position | null>>(
    () => {
      const map = new Map<string, Position | null>();
      for (const p of otherPlayers) {
        map.set(p.id, initialOtherPositions?.get(p.id) ?? null);
      }
      return map;
    }
  );
  const [otherVersions, setOtherVersions] = useState<Map<string, number>>(
    () => new Map(otherPlayers.map((p) => [p.id, 0]))
  );

  // Build name placements list for tray + graph rendering
  const namePlacements: NamePlacement[] = useMemo(
    () =>
      otherPlayers.map((gamePlayer) => ({
        gamePlayer,
        position: otherPositions.get(gamePlayer.id) ?? null,
      })),
    [otherPlayers, otherPositions]
  );

  const placedCount = useMemo(
    () => namePlacements.filter((n) => n.position !== null).length,
    [namePlacements]
  );
  const totalCount = namePlacements.length;

  // Can submit as long as self is placed (partial friend placement is OK)
  const canSubmit = step === "others" && selfPosition !== null;

  // Handle self token placement
  const handleSelfPlace = useCallback((pos: Position) => {
    setSelfPosition(pos);
    setSelfVersion((v) => v + 1);
    setStep("others");
  }, []);

  // Handle other name token placement
  const handleOtherPlace = useCallback((gamePlayerId: string, pos: Position) => {
    setOtherPositions((prev) => {
      const next = new Map(prev);
      next.set(gamePlayerId, pos);
      return next;
    });
    setOtherVersions((prev) => {
      const next = new Map(prev);
      next.set(gamePlayerId, (prev.get(gamePlayerId) ?? 0) + 1);
      return next;
    });
  }, []);

  // Handle other token removal (dragged off graph)
  const handleOtherRemove = useCallback((gamePlayerId: string) => {
    setOtherPositions((prev) => {
      const next = new Map(prev);
      next.set(gamePlayerId, null);
      return next;
    });
  }, []);

  // Submit all placements (including re-placed friends)
  const handleSubmit = useCallback(() => {
    if (!selfPosition) return;

    const guesses = namePlacements
      .filter((n): n is NamePlacement & { position: Position } => n.position !== null)
      .map((n) => ({
        targetGamePlayerId: n.gamePlayer.id,
        position: n.position,
      }));

    onSubmit(selfPosition, guesses);
  }, [selfPosition, namePlacements, onSubmit]);

  // Placed others (rendered inside the graph)
  const placedOthers = namePlacements.filter((n) => n.position !== null);

  // Compute label anchor directions via collision avoidance algorithm
  const labelAnchors = useMemo(() => {
    const inputs: { id: string; position: Position; labelWidth: number }[] = [];
    if (selfPosition) {
      inputs.push({ id: currentGamePlayerId, position: selfPosition, labelWidth: "YOU".length * 0.02 });
    }
    for (const n of placedOthers) {
      if (n.position) {
        inputs.push({
          id: n.gamePlayer.id,
          position: n.position,
          labelWidth: n.gamePlayer.display_name.length * 0.02,
        });
      }
    }
    return computeLabelAnchors(inputs);
  }, [selfPosition, placedOthers, currentGamePlayerId]);

  // Submit button label
  const submitLabel = (() => {
    if (placedCount === totalCount && totalCount > 0) {
      return `Submit all ${totalCount} placement${totalCount !== 1 ? "s" : ""}`;
    }
    if (placedCount > 0) {
      return `Submit ${placedCount} of ${totalCount} placed`;
    }
    return "Place friends, then submit";
  })();

  return (
    <LayoutGroup>
      <div className="flex flex-col h-full bg-surface">
        {/* Header: step indicator + instruction */}
        <div className="px-4 pt-4 pb-2">
          {/* Step indicator pills */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <StepPill active={step === "self"} label="1" />
            <div className="w-6 h-px bg-secondary/20" />
            <StepPill active={step === "others"} label="2" />
          </div>

          {/* Instruction text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="text-center font-display font-semibold text-lg text-foreground"
            >
              {step === "self"
                ? "Drag yourself onto the graph"
                : totalCount === 0
                  ? "No friends to place yet"
                  : "Now place everyone else!"}
            </motion.p>
          </AnimatePresence>

          {/* Progress — shown during others step */}
          {step === "others" && totalCount > 0 && (
            <p className="text-center text-sm text-secondary mt-1">
              {placedCount} of {totalCount} placed
            </p>
          )}
        </div>

        {/* Graph area */}
        <div className="flex-1 flex items-center justify-center px-4 py-2 min-h-0">
          <GameGraph
            axisXLow={game.axis_x_label_low}
            axisXHigh={game.axis_x_label_high}
            axisYLow={game.axis_y_label_low}
            axisYHigh={game.axis_y_label_high}
            graphRef={graphRef}
          >
            {/* Self token — always editable */}
            {selfPosition !== null && (
              <PlayerToken
                key={`self-v${selfVersion}`}
                id={currentGamePlayerId}
                label="YOU"
                variant="self"
                position={selfPosition}
                onPlace={handleSelfPlace}
                graphRef={graphRef}
                labelAnchor={labelAnchors.get(currentGamePlayerId)}
              />
            )}

            {/* Placed name tokens on the graph (all editable) */}
            {placedOthers.map((n) => (
              <PlayerToken
                key={`${n.gamePlayer.id}-v${otherVersions.get(n.gamePlayer.id) ?? 0}`}
                id={n.gamePlayer.id}
                label={n.gamePlayer.display_name}
                variant="friend"
                position={n.position}
                onPlace={(pos) => handleOtherPlace(n.gamePlayer.id, pos)}
                onRemove={() => handleOtherRemove(n.gamePlayer.id)}
                graphRef={graphRef}
                labelAnchor={labelAnchors.get(n.gamePlayer.id)}
              />
            ))}
          </GameGraph>
        </div>

        {/* Token tray — only in others step when there are unplaced friends */}
        <AnimatePresence>
          {step === "others" && totalCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25 }}
            >
              <TokenTray
                friends={namePlacements}
                onPlace={handleOtherPlace}
                onRemove={handleOtherRemove}
                graphRef={graphRef}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Self-place hint — show in self step when token hasn't been placed */}
        <AnimatePresence>
          {step === "self" && selfPosition === null && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.25 }}
              className="px-4 pb-4"
            >
              <div className="flex items-center justify-center gap-3 py-3">
                <PlayerToken
                  id={currentGamePlayerId}
                  label="YOU"
                  variant="self"
                  position={null}
                  onPlace={handleSelfPlace}
                  graphRef={graphRef}
                />
                <span className="font-body text-sm text-secondary">
                  Drag me onto the graph!
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button — enabled as long as self is placed */}
        <div className="px-4 pb-4">
          <AnimatePresence>
            {step === "others" && (
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.25 }}
                whileHover={canSubmit ? hoverLift : undefined}
                whileTap={canSubmit ? tapScale : undefined}
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`
                  w-full py-3 rounded-2xl font-display font-bold text-base text-white
                  transition-colors duration-200
                  ${canSubmit
                    ? "bg-splash shadow-lg shadow-splash/25 hover:shadow-xl"
                    : "bg-secondary/40 cursor-not-allowed"
                  }
                `}
              >
                {submitLabel}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}

/** Small step indicator pill */
function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <motion.div
      animate={{
        backgroundColor: active ? "#F9874E" : "#e5e5e7",
        color: active ? "#ffffff" : "#66666e",
        scale: active ? 1 : 0.9,
      }}
      transition={springTransition}
      className="w-7 h-7 rounded-full flex items-center justify-center font-display text-xs font-bold"
    >
      {label}
    </motion.div>
  );
}

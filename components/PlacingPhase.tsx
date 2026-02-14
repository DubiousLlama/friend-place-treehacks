"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { Game, GamePlayer, Position, NamePlacement } from "@/lib/game-types";
import { GameGraph, type TransformState } from "@/components/GameGraph";
import { PlayerToken } from "@/components/PlayerToken";
import { TokenTray } from "@/components/TokenTray";
import { computeLabelAnchors } from "@/lib/label-placement";
import { tapScale, hoverLift, springTransition } from "@/lib/motion";
import { theme } from "@/lib/theme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MOBILE_SIZES, DESKTOP_SIZES, toNormalizedSizes } from "@/lib/sizes";
import type { PlacementSizes } from "@/lib/sizes";

interface PlacingPhaseProps {
  game: Game;
  /** The game_players.id of the current user's claimed slot */
  currentGamePlayerId: string;
  /** All other name slots in the game (claimed and unclaimed) */
  otherPlayers: GamePlayer[];
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
  onSubmit,
}: PlacingPhaseProps) {
  const graphRef = useRef<HTMLDivElement | null>(null);

  // ---- Responsive sizes ----
  const isMobile = useIsMobile();
  const sizeConfig = isMobile ? MOBILE_SIZES : DESKTOP_SIZES;

  // Measure actual graph dimensions for accurate normalised placement sizes
  const [graphDims, setGraphDims] = useState({ width: 350, height: 350 });

  useEffect(() => {
    const el = graphRef.current;
    if (!el) return;

    // Read initial size
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setGraphDims({ width: rect.width, height: rect.height });
    }

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setGraphDims({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute normalised sizes for the placement algorithm
  const placementSizes: PlacementSizes = useMemo(
    () => toNormalizedSizes(sizeConfig, graphDims.width, graphDims.height),
    [sizeConfig, graphDims]
  );

  // ---- Zoom-aware padding ----
  const [graphScale, setGraphScale] = useState(1);
  const handleTransformChange = useCallback((t: TransformState) => {
    setGraphScale(t.scale);
  }, []);
  const isZoomed = graphScale > 1.05;

  // ---- State ----
  const [step, setStep] = useState<Step>("self");
  const [selfPosition, setSelfPosition] = useState<Position | null>(null);
  const [selfVersion, setSelfVersion] = useState(0);
  const [otherPositions, setOtherPositions] = useState<Map<string, Position | null>>(
    () => new Map(otherPlayers.map((p) => [p.id, null]))
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

  const allOthersPlaced = useMemo(
    () => namePlacements.every((n) => n.position !== null),
    [namePlacements]
  );

  const canSubmit = step === "others" && selfPosition !== null && allOthersPlaced;

  // ---- Handlers ----
  const handleSelfPlace = useCallback((pos: Position) => {
    setSelfPosition(pos);
    setSelfVersion((v) => v + 1);
    setStep("others");
  }, []);

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

  const handleOtherRemove = useCallback((gamePlayerId: string) => {
    setOtherPositions((prev) => {
      const next = new Map(prev);
      next.set(gamePlayerId, null);
      return next;
    });
  }, []);

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

  // ---- Label placement ----
  const placedOthers = namePlacements.filter((n) => n.position !== null);

  const labelAnchors = useMemo(() => {
    const { charWidth, padWidth } = placementSizes;
    const inputs: { id: string; position: Position; labelWidth: number }[] = [];

    if (selfPosition) {
      inputs.push({
        id: currentGamePlayerId,
        position: selfPosition,
        labelWidth: "YOU".length * charWidth + padWidth,
      });
    }
    for (const n of placedOthers) {
      if (n.position) {
        inputs.push({
          id: n.gamePlayer.id,
          position: n.position,
          labelWidth: n.gamePlayer.display_name.length * charWidth + padWidth,
        });
      }
    }
    return computeLabelAnchors(inputs, placementSizes);
  }, [selfPosition, placedOthers, currentGamePlayerId, placementSizes]);

  // ---- Render ----
  return (
    <LayoutGroup>
      <div className="flex flex-col h-full bg-surface">
        {/* Header: step indicator + instruction */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <StepPill active={step === "self"} label="1" />
            <div className="w-6 h-px bg-secondary/20" />
            <StepPill active={step === "others"} label="2" />
          </div>

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
                : "Now place everyone else!"}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Graph area — padding shrinks when zoomed to maximize space */}
        <div className={`flex-1 flex items-center justify-center min-h-0 transition-[padding] duration-200 ${isZoomed ? "px-1 py-1" : "px-4 py-2"}`}>
          <GameGraph
            axisXLow={game.axis_x_label_low}
            axisXHigh={game.axis_x_label_high}
            axisYLow={game.axis_y_label_low}
            axisYHigh={game.axis_y_label_high}
            graphRef={graphRef}
            sizes={sizeConfig}
            onTransformChange={handleTransformChange}
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
                sizes={sizeConfig}
              />
            )}

            {/* Placed name tokens */}
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
                sizes={sizeConfig}
              />
            ))}
          </GameGraph>
        </div>

        {/* Token tray — only in others step */}
        <AnimatePresence>
          {step === "others" && (
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
                sizes={sizeConfig}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Self-place hint */}
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
                  sizes={sizeConfig}
                />
                <span className="font-body text-sm text-secondary">
                  Drag me onto the graph!
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button */}
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
                {canSubmit
                  ? "Submit Placements"
                  : `Place ${namePlacements.filter((n) => n.position === null).length} more name${namePlacements.filter((n) => n.position === null).length !== 1 ? "s" : ""}`}
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
        backgroundColor: active ? theme.splash : theme.surfaceMuted,
        color: active ? theme.white : theme.secondary,
        scale: active ? 1 : 0.9,
      }}
      transition={springTransition}
      className="w-7 h-7 rounded-full flex items-center justify-center font-display text-xs font-bold"
    >
      {label}
    </motion.div>
  );
}

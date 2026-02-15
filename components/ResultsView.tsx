"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { GameGraph } from "@/components/GameGraph";
import { assignPlayerColors } from "@/lib/player-colors";
import {
  computeScoreBreakdowns,
  computeAllGuessDetails,
  type PlayerScoreBreakdown,
  type GuessScoreDetail,
} from "@/lib/scoring-client";
import { normalizedToPercent } from "@/lib/graph-utils";
import { computeLabelAnchors, type Anchor, type Obstacle } from "@/lib/label-placement";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  MOBILE_SIZES,
  DESKTOP_SIZES,
  MOBILE_RESULTS_SIZES,
  DESKTOP_RESULTS_SIZES,
  labelStyleToNormalized,
} from "@/lib/sizes";
import { springTransition } from "@/lib/motion";
import { useAuth } from "@/lib/use-auth";
import type { Game, GamePlayer, Guess } from "@/lib/game-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRAPH_FADE_DURATION = 300; // ms for graph content fade-in
const SCORE_START_DELAY = 600; // ms after graph visible before scores begin counting
const SCORE_DURATION = 1600; // ms for each player's score to count up
const SCORE_STAGGER = 200; // ms delay between each player's animation start
const EXPLORE_DELAY = 600; // ms after last score before entering explore phase


// ---------------------------------------------------------------------------
// Label style helper (mirrors PlayerToken labelStyle for 8 anchor directions)
// ---------------------------------------------------------------------------

function resultLabelStyle(
  anchor: Anchor,
  hitSize: number,
  labelOffset: number,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  };
  const c = hitSize / 2;
  switch (anchor) {
    case "ne":
      return { ...base, left: c + labelOffset, bottom: c };
    case "e":
      return { ...base, left: c + labelOffset, top: "50%", transform: "translateY(-50%)" };
    case "se":
      return { ...base, left: c + labelOffset, top: c };
    case "n":
      return { ...base, left: "50%", transform: "translateX(-50%)", bottom: c + labelOffset };
    case "s":
      return { ...base, left: "50%", transform: "translateX(-50%)", top: c + labelOffset };
    case "nw":
      return { ...base, right: c + labelOffset, bottom: c };
    case "sw":
      return { ...base, right: c + labelOffset, top: c };
    case "w":
      return { ...base, right: c + labelOffset, top: "50%", transform: "translateY(-50%)" };
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultsPhase = "network-reveal" | "score-reveal" | "explore";

interface ResultsViewProps {
  game: Game;
  gamePlayers: GamePlayer[];
  currentPlayerId: string;
}

interface SortedPlayer {
  gamePlayerId: string;
  displayName: string;
  totalScore: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// ResultsView
// ---------------------------------------------------------------------------

export function ResultsView({ game, gamePlayers, currentPlayerId }: ResultsViewProps) {
  const isMobile = useIsMobile();
  const { isLinked } = useAuth();
  const sizeConfig = isMobile ? MOBILE_SIZES : DESKTOP_SIZES;
  const resultsSizes = isMobile ? MOBILE_RESULTS_SIZES : DESKTOP_RESULTS_SIZES;
  const graphRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const lastTouchX = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 150;
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [showDailyPrompt, setShowDailyPrompt] = useState(false);
  const [savingDaily, setSavingDaily] = useState(false);

  // ---- Data fetching ----
  const [allGuesses, setAllGuesses] = useState<Guess[]>([]);
  const [loadingGuesses, setLoadingGuesses] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("guesses")
      .select("*")
      .eq("game_id", game.id)
      .then(({ data }) => {
        setAllGuesses((data as Guess[]) ?? []);
        setLoadingGuesses(false);
      });
  }, [game.id]);

  // Award consensus tags when viewing results (idempotent; handles cron-ended games)
  useEffect(() => {
    if (game?.id) {
      fetch(`/api/games/${game.id}/award-tags`, { method: "POST" }).catch(() => {});
    }
  }, [game?.id]);

  // ---- Derived data ----

  const claimedPlayers = useMemo(
    () => gamePlayers.filter((gp) => gp.player_id != null),
    [gamePlayers],
  );

  // Color assignment (sorted by claimed_at for stable ordering)
  const colorMap = useMemo(() => {
    const sorted = [...claimedPlayers].sort(
      (a, b) => (a.claimed_at ?? "").localeCompare(b.claimed_at ?? ""),
    );
    return assignPlayerColors(sorted.map((gp) => gp.id));
  }, [claimedPlayers]);

  // Score breakdowns
  const breakdowns = useMemo(
    () => (loadingGuesses ? new Map<string, PlayerScoreBreakdown>() : computeScoreBreakdowns(gamePlayers, allGuesses)),
    [gamePlayers, allGuesses, loadingGuesses],
  );

  // All guess details (flat list for graph rendering)
  const guessDetails = useMemo(
    () => (loadingGuesses ? [] : computeAllGuessDetails(gamePlayers, allGuesses)),
    [gamePlayers, allGuesses, loadingGuesses],
  );

  // Any guess on the board earned the best friend bonus (for legend visibility)
  const hasAnyBestFriendBonus = useMemo(
    () => guessDetails.some((d) => d.bestFriendBonus > 0),
    [guessDetails],
  );

  // Guess lookup by ID
  const guessLookup = useMemo(() => {
    const m = new Map<string, Guess>();
    for (const g of allGuesses) m.set(g.id, g);
    return m;
  }, [allGuesses]);

  // GamePlayer lookup by ID
  const gpLookup = useMemo(() => {
    const m = new Map<string, GamePlayer>();
    for (const gp of gamePlayers) m.set(gp.id, gp);
    return m;
  }, [gamePlayers]);

  // Self-placement lookup
  const selfPlacements = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const gp of gamePlayers) {
      if (gp.self_x != null && gp.self_y != null) {
        m.set(gp.id, { x: gp.self_x, y: gp.self_y });
      }
    }
    return m;
  }, [gamePlayers]);

  // Sorted players by score (descending) with rank
  const sortedPlayers: SortedPlayer[] = useMemo(() => {
    return claimedPlayers
      .map((gp) => {
        const b = breakdowns.get(gp.id);
        // Single source of truth: scores from lib/scoring via computeScoreBreakdowns
        const totalScore = b?.totalScore ?? 0;
        return {
          gamePlayerId: gp.id,
          displayName: gp.display_name,
          totalScore,
          rank: 0,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((p, i) => ({ ...p, rank: i }));
  }, [claimedPlayers, breakdowns]);

  // For breakdown mode: targets the active player guessed
  const breakdownTargets = useMemo(() => {
    return (id: string) => {
      const b = breakdowns.get(id);
      return new Set(b?.guessDetails.map((d) => d.targetId) ?? []);
    };
  }, [breakdowns]);

  // ---- Animation state ----
  const [phase, setPhase] = useState<ResultsPhase>("network-reveal");
  const [scoreProgress, setScoreProgress] = useState(0);
  const graphVisible = true; // graph shown immediately; scores count up after

  // ---- Graph dimension tracking for label placement ----
  const [graphDims, setGraphDims] = useState({ width: 0, height: 0 });

  // Poll until graphRef is attached, then use ResizeObserver for ongoing tracking.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    let frame: number;

    function tryAttach() {
      const el = graphRef.current;
      if (!el) { frame = requestAnimationFrame(tryAttach); return; }
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setGraphDims({ width: r.width, height: r.height });
      ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setGraphDims({ width, height });
      });
      ro.observe(el);
    }

    frame = requestAnimationFrame(tryAttach);
    return () => { cancelAnimationFrame(frame); ro?.disconnect(); };
  }, []);

  // Normalised label metrics per category for the cartographic algorithm
  const normLabel = useMemo(() => {
    const { width: gw, height: gh } = graphDims;
    if (gw === 0 || gh === 0) return undefined;
    const off = resultsSizes.nameLabelOffset;
    const result = {
      placer:  labelStyleToNormalized(resultsSizes.placerLabel,  off, gw, gh),
      guesser: labelStyleToNormalized(resultsSizes.guesserLabel, resultsSizes.guessLabelOffset, gw, gh),
      points:  labelStyleToNormalized(resultsSizes.pointsLabel,  resultsSizes.guessLabelOffset, gw, gh),
      bonus:   labelStyleToNormalized(resultsSizes.bonusLabel,   off, gw, gh),
    };
    return result;
  }, [graphDims, resultsSizes]);

  // Carousel order (claimed_at, matches color assignment) — used for mobile dot row
  const carouselOrderedPlayers = useMemo(
    () => [...claimedPlayers].sort(
      (a, b) => (a.claimed_at ?? "").localeCompare(b.claimed_at ?? ""),
    ),
    [claimedPlayers],
  );

  // Interaction state
  const [activeNetwork, setActiveNetwork] = useState<string | null>(null);
  const [activeBreakdown, setActiveBreakdown] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselDragProgress, setCarouselDragProgress] = useState(0);
  const [hoveredGuessTargetId, setHoveredGuessTargetId] = useState<string | null>(null);

  // Mobile: when entering explore phase, start with current player's network highlighted (deferred to avoid sync setState in effect)
  useEffect(() => {
    if (!isMobile || phase !== "explore" || carouselOrderedPlayers.length === 0) return;
    const idx = carouselOrderedPlayers.findIndex(
      (gp) => gp.player_id === currentPlayerId,
    );
    if (idx >= 0) queueMicrotask(() => setCarouselIndex(idx));
  }, [isMobile, phase, carouselOrderedPlayers, currentPlayerId]);

  // Blended carousel index during drag (mobile); used to interpolate between two network views
  const totalSlots = carouselOrderedPlayers.length + 1;
  const effectiveCarouselIndexFloat = Math.max(
    0,
    Math.min(totalSlots, carouselIndex + carouselDragProgress),
  );
  const carouselBlend = useMemo(() => {
    if (carouselDragProgress === 0) return null;
    const fromIndex = Math.floor(effectiveCarouselIndexFloat);
    const toIndex = Math.min(fromIndex + 1, totalSlots);
    const blendT = effectiveCarouselIndexFloat - fromIndex;
    return {
      fromId: fromIndex < carouselOrderedPlayers.length ? carouselOrderedPlayers[fromIndex].id : null,
      toId: toIndex < carouselOrderedPlayers.length ? carouselOrderedPlayers[toIndex].id : null,
      fromOpacity: 1 - blendT,
      toOpacity: blendT,
    };
  }, [carouselDragProgress, effectiveCarouselIndexFloat, carouselOrderedPlayers, totalSlots]);

  // On mobile in explore phase, highlighted network is driven by carousel; otherwise use activeNetwork (desktop hover/tap)
  const effectiveActiveNetwork =
    isMobile && phase === "explore"
      ? carouselBlend
        ? (carouselBlend.fromOpacity >= 0.5 ? carouselBlend.fromId : carouselBlend.toId)
        : carouselIndex < carouselOrderedPlayers.length
          ? carouselOrderedPlayers[carouselIndex].id
          : null
      : activeNetwork;

  // Build obstacles from all self-placement dots so labels avoid them.
  const dotObstacles = useMemo<Obstacle[]>(() => {
    const { width: gw, height: gh } = graphDims;
    if (gw === 0 || gh === 0) return [];
    const refDim = Math.min(gw, gh);
    // Use slightly larger radii than visual dot to create breathing room
    const selfR = ((resultsSizes.selfDotSize / 2) + 4) / refDim;
    const guessR = ((resultsSizes.guessDotSize / 2) + 2) / refDim;
    const obs: Obstacle[] = [];

    for (const gp of gamePlayers) {
      const pos = selfPlacements.get(gp.id);
      if (pos) obs.push({ position: pos, radius: selfR });
    }

    // Also add visible guess dots as obstacles
    if (effectiveActiveNetwork || activeBreakdown) {
      for (const detail of guessDetails) {
        const isVisible =
          (activeBreakdown && detail.guesserId === activeBreakdown) ||
          (effectiveActiveNetwork && detail.targetId === effectiveActiveNetwork);
        if (!isVisible) continue;
        const guess = guessLookup.get(detail.guessId);
        if (guess) obs.push({ position: { x: guess.guess_x, y: guess.guess_y }, radius: guessR });
      }
    }

    return obs;
  }, [graphDims, resultsSizes, gamePlayers, selfPlacements, guessDetails, guessLookup, effectiveActiveNetwork, activeBreakdown]);

  // Compute optimal anchor directions for ALL visible labels (self + guess).
  // Recomputes whenever interaction state changes so new labels don't collide.
  const allLabelAnchors = useMemo(() => {
    if (!normLabel) return new Map<string, Anchor>();
    const pl = normLabel.placer;
    const inputs: { id: string; position: { x: number; y: number }; labelWidth: number; labelH?: number; offset?: number }[] = [];

    // Self-placement labels (always visible) — use placer metrics
    for (const gp of gamePlayers) {
      const pos = selfPlacements.get(gp.id);
      if (!pos) continue;
      inputs.push({
        id: `self-${gp.id}`,
        position: pos,
        labelWidth: gp.display_name.length * pl.charWidth + pl.padWidth,
        labelH: pl.labelH,
        offset: pl.offset,
      });
    }

    // Guess-dot labels (network mode only — in breakdown mode points are in the scoreboard list)
    if (effectiveActiveNetwork && !activeBreakdown) {
      const gl = normLabel.guesser;
      for (const detail of guessDetails) {
        if (detail.targetId !== effectiveActiveNetwork) continue;
        const guess = guessLookup.get(detail.guessId);
        if (!guess) continue;
        const labelText = gpLookup.get(detail.guesserId)?.display_name ?? "";
        inputs.push({
          id: `guess-${detail.guessId}`,
          position: { x: guess.guess_x, y: guess.guess_y },
          labelWidth: labelText.length * gl.charWidth + gl.padWidth,
          labelH: gl.labelH,
          offset: gl.offset,
        });
      }
    }

    return computeLabelAnchors(inputs, pl, dotObstacles);
  }, [gamePlayers, selfPlacements, normLabel, guessDetails, guessLookup, gpLookup, effectiveActiveNetwork, activeBreakdown, dotObstacles]);

  // Phase 1 → 2: after graph is visible, wait then start score count-up
  useEffect(() => {
    if (phase !== "network-reveal" || loadingGuesses || sortedPlayers.length === 0) return;
    const timer = setTimeout(() => setPhase("score-reveal"), SCORE_START_DELAY);
    return () => clearTimeout(timer);
  }, [phase, loadingGuesses, sortedPlayers.length]);

  // Phase 2: score count-up animation
  useEffect(() => {
    if (phase !== "score-reveal") return;

    const totalAnimTime =
      SCORE_DURATION + SCORE_STAGGER * Math.max(0, sortedPlayers.length - 1);
    const start = performance.now();
    let raf: number;

    function tick() {
      const elapsed = performance.now() - start;
      const p = Math.min(1, elapsed / totalAnimTime);
      setScoreProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, sortedPlayers.length]);

  // Phase 2 → 3: transition to explore after scores complete
  useEffect(() => {
    if (scoreProgress >= 1 && phase === "score-reveal") {
      const timer = setTimeout(() => setPhase("explore"), EXPLORE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [scoreProgress, phase]);

  const scoreAnimDone = scoreProgress >= 1;

  // ---- Score display helper ----
  const getDisplayedScore = useCallback(
    (index: number, totalScore: number) => {
      if (scoreAnimDone) return Math.round(totalScore);
      const totalAnimTime =
        SCORE_DURATION + SCORE_STAGGER * Math.max(0, sortedPlayers.length - 1);
      const elapsed = scoreProgress * totalAnimTime;
      const playerElapsed = Math.max(0, elapsed - index * SCORE_STAGGER);
      const progress = Math.min(1, playerElapsed / SCORE_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      return Math.round(totalScore * eased);
    },
    [scoreProgress, scoreAnimDone, sortedPlayers.length],
  );

  // ---- Interaction handlers ----

  const handleScoreTap = useCallback(
    (gamePlayerId: string) => {
      if (!scoreAnimDone) return;
      setActiveBreakdown((prev) => (prev === gamePlayerId ? null : gamePlayerId));
      setActiveNetwork(null);
      setHoveredGuessTargetId(null);
    },
    [scoreAnimDone],
  );

  const handleNetworkHover = useCallback(
    (targetId: string | null) => {
      if (activeBreakdown) return; // breakdown takes priority
      setActiveNetwork(targetId);
    },
    [activeBreakdown],
  );

  const handleNetworkTap = useCallback(
    (targetId: string) => {
      if (activeBreakdown) return;
      if (isMobile) {
        const idx = carouselOrderedPlayers.findIndex((gp) => gp.id === targetId);
        if (idx >= 0) {
          const isCurrentlySelected = effectiveActiveNetwork === targetId;
          setCarouselIndex(isCurrentlySelected ? carouselOrderedPlayers.length : idx);
        }
        // else: tap on unknown target
      } else {
        setActiveNetwork((prev) => (prev === targetId ? null : targetId));
      }
    },
    [activeBreakdown, isMobile, effectiveActiveNetwork, carouselOrderedPlayers],
  );

  const handleGraphBackgroundClick = useCallback(() => {
    setActiveBreakdown(null);
    setActiveNetwork(null);
    setHoveredGuessTargetId(null);
  }, []);

  // Mobile: swipe left/right to cycle network carousel; drag progress gives live feedback
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const x = e.nativeEvent.touches[0].clientX;
    touchStartX.current = x;
    lastTouchX.current = null;
    setCarouselDragProgress(0);
    setActiveBreakdown(null);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartX.current;
      if (start == null) return;
      const current = e.nativeEvent.touches[0].clientX;
      lastTouchX.current = current;
      const delta = start - current;
      const progress = Math.max(-1, Math.min(1, delta / SWIPE_THRESHOLD));
      setCarouselDragProgress(progress);
    },
    [],
  );

  const COMMIT_THRESHOLD = 0.4;

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      const endFromEvent = e.nativeEvent.changedTouches?.[0]?.clientX;
      const end = lastTouchX.current ?? endFromEvent ?? start;
      lastTouchX.current = null;
      if (start == null) return;
      const delta = end - start;
      const progress = Math.max(-1, Math.min(1, delta / SWIPE_THRESHOLD));
      const totalSlotsVal = carouselOrderedPlayers.length + 1;
      const step = progress <= -COMMIT_THRESHOLD ? 1 : progress >= COMMIT_THRESHOLD ? -1 : 0;
      const newIndex = Math.max(
        0,
        Math.min(totalSlotsVal - 1, carouselIndex + step),
      );
      setCarouselIndex(newIndex);
      setCarouselDragProgress(0);
    },
    [carouselIndex, carouselOrderedPlayers.length],
  );

  const handleCreateGroup = useCallback(async () => {
    const name = groupNameInput.trim() || gamePlayers.map((p) => p.display_name).join(", ");
    if (!currentPlayerId) return;
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
    const mySlot = gamePlayers.find((p) => p.player_id === currentPlayerId);
    await supabase.from("group_members").insert({
      group_id: group.id,
      player_id: currentPlayerId,
      is_anonymous: false,
      sort_order: 0,
    });
    let so = 1;
    for (const gp of gamePlayers) {
      if (gp.player_id === currentPlayerId) continue;
      await supabase.from("group_members").insert({
        group_id: group.id,
        player_id: gp.player_id ?? null,
        anonymous_display_name: gp.player_id == null ? gp.display_name : null,
        is_anonymous: gp.player_id == null,
        sort_order: so++,
      });
    }
    setCreatedGroupId(group.id);
    setSavingGroup(false);
    setShowCreateGroup(false);
    setShowDailyPrompt(true);
  }, [currentPlayerId, gamePlayers, groupNameInput]);

  const handleDailyChoice = useCallback(async (enable: boolean) => {
    if (!createdGroupId) return;
    setSavingDaily(true);
    const supabase = createClient();
    await supabase.from("saved_groups").update({ daily_game_enabled: enable }).eq("id", createdGroupId);
    setSavingDaily(false);
    setShowDailyPrompt(false);
    setCreatedGroupId(null);
  }, [createdGroupId]);

  // ---- Opacity helpers ----

  const getSelfDotOpacity = useCallback(
    (playerId: string) => {
      if (activeBreakdown) {
        if (hoveredGuessTargetId) {
          if (playerId === hoveredGuessTargetId) return 1;
          if (playerId === activeBreakdown) return 0.35;
          if (breakdownTargets(activeBreakdown).has(playerId)) return 0.5;
          return 0.2;
        }
        if (playerId === activeBreakdown) return 0.35;
        if (breakdownTargets(activeBreakdown).has(playerId)) return 0.8;
        return 0.2;
      }
      if (carouselBlend) {
        if (playerId === carouselBlend.fromId) return 0.25 + 0.75 * carouselBlend.fromOpacity;
        if (playerId === carouselBlend.toId) return 0.25 + 0.75 * carouselBlend.toOpacity;
        return 0.25;
      }
      if (effectiveActiveNetwork) {
        return playerId === effectiveActiveNetwork ? 1 : 0.25;
      }
      return 1;
    },
    [activeBreakdown, effectiveActiveNetwork, breakdownTargets, hoveredGuessTargetId, carouselBlend],
  );

  const getGuessDotOpacity = useCallback(
    (detail: GuessScoreDetail) => {
      if (activeBreakdown) {
        if (hoveredGuessTargetId) {
          if (detail.guesserId === activeBreakdown && detail.targetId === hoveredGuessTargetId) return 0.95;
          if (detail.guesserId === activeBreakdown) return 0.4;
          return 0.12;
        }
        return detail.guesserId === activeBreakdown ? 0.9 : 0.12;
      }
      if (carouselBlend) {
        if (detail.targetId === carouselBlend.fromId) return 0.25 + 0.75 * carouselBlend.fromOpacity;
        if (detail.targetId === carouselBlend.toId) return 0.25 + 0.75 * carouselBlend.toOpacity;
        return 0.12;
      }
      if (effectiveActiveNetwork) {
        return detail.targetId === effectiveActiveNetwork ? 0.85 : 0.12;
      }
      return 0.7;
    },
    [activeBreakdown, effectiveActiveNetwork, hoveredGuessTargetId, carouselBlend],
  );

  const getLineOpacity = useCallback(
    (detail: GuessScoreDetail) => {
      const baseOpacity = 0.15 + detail.accuracy * 0.35;
      if (activeBreakdown) {
        if (hoveredGuessTargetId) {
          if (detail.guesserId === activeBreakdown && detail.targetId === hoveredGuessTargetId) {
            return Math.min(0.85, baseOpacity * 2.5);
          }
          if (detail.guesserId === activeBreakdown) return 0.15;
          return 0.04;
        }
        return detail.guesserId === activeBreakdown ? Math.min(0.7, baseOpacity * 2.5) : 0.04;
      }
      if (carouselBlend) {
        const blendOpacity = (o: number) => Math.min(0.65, baseOpacity * 2) * (0.25 + 0.75 * o);
        if (detail.targetId === carouselBlend.fromId) return blendOpacity(carouselBlend.fromOpacity);
        if (detail.targetId === carouselBlend.toId) return blendOpacity(carouselBlend.toOpacity);
        return 0.04;
      }
      if (effectiveActiveNetwork) {
        return detail.targetId === effectiveActiveNetwork ? Math.min(0.65, baseOpacity * 2) : 0.04;
      }
      return baseOpacity;
    },
    [activeBreakdown, effectiveActiveNetwork, hoveredGuessTargetId, carouselBlend],
  );

  // ---- Loading state ----

  if (loadingGuesses) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-secondary font-body">Loading results...</p>
      </div>
    );
  }

  // ---- Breakdown summary ----
  const breakdownPlayer = activeBreakdown ? breakdowns.get(activeBreakdown) : null;

  // ---- Render ----

  const scoreboard = (
    <div className="flex flex-col gap-1.5">
      <h2 className="font-display font-bold text-lg text-foreground mb-1">
        {activeBreakdown ? "Score breakdown" : "Results"}
      </h2>
      {sortedPlayers.map((player, i) => {
        const color = colorMap.get(player.gamePlayerId);
        const displayed = getDisplayedScore(i, player.totalScore);
        const isWinner = i === 0 && scoreAnimDone;
        const isActive = activeBreakdown === player.gamePlayerId;
        const isMe = gpLookup.get(player.gamePlayerId)?.player_id === currentPlayerId;
        const playerBreakdown = isActive ? breakdowns.get(player.gamePlayerId) : null;
        const totalBestFriendBonus =
          breakdowns.get(player.gamePlayerId)?.guessDetails.reduce((s, d) => s + d.bestFriendBonus, 0) ?? 0;

        return (
          <div key={player.gamePlayerId} className="flex flex-col gap-0">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: isActive ? 1.02 : 1,
              }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              onClick={() => handleScoreTap(player.gamePlayerId)}
              className={`
                flex items-center gap-3 rounded-xl cursor-pointer
                transition-all duration-300 select-none
                ${isActive
                  ? "bg-white shadow-lg ring-2 px-3 py-2.5"
                  : "hover:bg-white/60 px-3 py-2.5"
                }
              `}
              style={isActive ? {
                borderLeft: `3px solid ${color?.color}`,
                boxShadow: `0 0 0 2px ${color?.color}40, 0 4px 12px rgba(0,0,0,0.08)`,
              } : undefined}
            >
              {/* Rank (replaced by winner badge for 1st place) */}
              <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                {isWinner ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={springTransition}
                    className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center"
                  >
                    <span className="text-[10px] font-bold text-white">1</span>
                  </motion.div>
                ) : (
                  <span className="text-xs font-body text-secondary">
                    {i + 1}
                  </span>
                )}
              </span>

              {/* Color dot */}
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color?.color }}
              />

              {/* Name */}
              <span className="flex-1 text-sm font-body font-medium text-foreground truncate">
                {player.displayName}
                {isMe && (
                  <span className="text-xs text-secondary ml-1">(you)</span>
                )}
              </span>

              {/* Score */}
              <span className="text-sm font-display font-bold tabular-nums shrink-0 text-foreground">
                {displayed}
              </span>

              {/* Active indicator */}
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-secondary shrink-0"
                >
                  ▾
                </motion.span>
              )}
            </motion.div>

            {/* Score breakdown — directly below this player when selected */}
            <AnimatePresence>
              {playerBreakdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden flex flex-col gap-1 pl-3 mt-4"
                >
                  {playerBreakdown.guessDetails.map((detail) => {
                    const targetName = gpLookup.get(detail.targetId)?.display_name ?? "";
                    const targetColor = colorMap.get(detail.targetId);
                    const distanceStr = detail.distance.toFixed(2);
                    return (
                      <React.Fragment key={detail.guessId}>
                        <div
                          className="flex items-start gap-2 text-xs font-body text-secondary leading-tight"
                          onMouseEnter={() => !isMobile && setHoveredGuessTargetId(detail.targetId)}
                          onMouseLeave={() => !isMobile && setHoveredGuessTargetId(null)}
                        >
                          <span
                            className="shrink-0 rounded-full mt-0.5"
                            style={{
                              width: 8,
                              height: 8,
                              backgroundColor: targetColor?.color ?? "#888",
                            }}
                          />
                          <span className="flex-1 line-clamp-2 leading-tight min-w-0">
                            {distanceStr} units away from {targetName}
                          </span>
                          <span className="font-medium text-foreground tabular-nums shrink-0 pt-px">
                            +{Math.round(detail.guesserPoints)}
                          </span>
                        </div>
                        {detail.bestFriendBonus > 0 && (
                          <div className="flex items-start gap-2 text-xs font-body text-secondary leading-tight">
                            <span className="w-2 shrink-0" aria-hidden />
                            <span className="flex-1 line-clamp-2 leading-tight min-w-0">
                              Best friend bonus +{detail.bestFriendBonus}
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {playerBreakdown.bonusDetails.length > 0 && (() => {
                    const breakdownColor = colorMap.get(playerBreakdown.gamePlayerId);
                    const avgDist = (
                      playerBreakdown.bonusDetails.reduce((s, d) => s + d.distance, 0) /
                      playerBreakdown.bonusDetails.length
                    ).toFixed(2);
                    return (
                      <div
                        className="flex items-start gap-2 text-xs font-body text-secondary leading-tight"
                        onMouseEnter={() => !isMobile && setHoveredGuessTargetId(null)}
                        onMouseLeave={() => !isMobile && setHoveredGuessTargetId(null)}
                      >
                        <span
                          className="shrink-0 rounded-full mt-0.5"
                          style={{
                            width: 8,
                            height: 8,
                            backgroundColor: breakdownColor?.color ?? "#888",
                          }}
                        />
                        <span className="flex-1 line-clamp-2 leading-tight min-w-0">
                          {avgDist} average friend distance
                        </span>
                        <span className="font-medium text-foreground tabular-nums shrink-0 pt-px">
                          +{Math.round(playerBreakdown.bonusPoints)}
                        </span>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-black/5 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className="shrink-0 rounded-full"
            style={{
              width: resultsSizes.selfDotSize * 0.7,
              height: resultsSizes.selfDotSize * 0.7,
              backgroundColor: "#888",
              border: "2px solid white",
              boxShadow: "0 0 0 1px #88888850, 0 1px 3px rgba(0,0,0,0.15)",
            }}
          />
          <span className="text-xs font-body text-secondary">Self-placement</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="shrink-0 rounded-full"
            style={{
              width: resultsSizes.guessDotSize,
              height: resultsSizes.guessDotSize,
              backgroundColor: "#888",
              marginLeft: (resultsSizes.selfDotSize * 0.7 - resultsSizes.guessDotSize) / 2,
              marginRight: (resultsSizes.selfDotSize * 0.7 - resultsSizes.guessDotSize) / 2,
            }}
          />
          <span className="text-xs font-body text-secondary">Guess by another player</span>
        </div>
        {hasAnyBestFriendBonus && (
          <div className="flex items-center gap-2">
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: resultsSizes.guessDotSize,
                height: resultsSizes.guessDotSize,
                marginLeft: (resultsSizes.selfDotSize * 0.7 - resultsSizes.guessDotSize) / 2,
                marginRight: (resultsSizes.selfDotSize * 0.7 - resultsSizes.guessDotSize) / 2,
                fontSize: resultsSizes.guessDotSize * 2,
                lineHeight: 1,
                color: "#888",
              }}
            >
              ★
            </span>
            <span className="text-xs font-body text-secondary">Spectacular guess by another player</span>
          </div>
        )}
      </div>

      {/* Breakdown summary card */}
      <AnimatePresence>
        {breakdownPlayer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 px-3 py-2.5 rounded-xl bg-white/80 border border-black/5 text-xs font-body text-secondary">
              <span className="font-medium text-foreground">
                {breakdownPlayer.displayName}
              </span>{" "}
              guessed {breakdownPlayer.guessDetails.length} friend
              {breakdownPlayer.guessDetails.length !== 1 ? "s" : ""} for{" "}
              <span className="font-medium text-foreground">
                {Math.round(breakdownPlayer.guessPoints)} pts
              </span>
              {breakdownPlayer.bonusPoints > 0 && (
                <>
                  {" "}+ <span className="font-medium text-foreground">
                    {Math.round(breakdownPlayer.bonusPoints)} bonus
                  </span>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLinked && (
        <div className="mt-4 pt-3 border-t border-black/5">
          <h3 className="font-display font-semibold text-sm text-foreground mb-1">Create a group</h3>
          <p className="text-xs text-secondary mb-2">Save this crew to start games with one tap later.</p>
          {!showCreateGroup && !showDailyPrompt && (
            <button
              type="button"
              onClick={() => setShowCreateGroup(true)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Create group from this game
            </button>
          )}
          {showCreateGroup && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                placeholder="Group name (or leave blank for member list)"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={savingGroup}
                  className="rounded-lg bg-splash text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {savingGroup ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateGroup(false); setGroupNameInput(""); }}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {showDailyPrompt && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-foreground">Create a recurring daily game? We&apos;ll send email reminders to members each day to play.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDailyChoice(true)}
                  disabled={savingDaily}
                  className="rounded-lg bg-splash text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleDailyChoice(false)}
                  disabled={savingDaily}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const graphContent = graphVisible && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: GRAPH_FADE_DURATION / 1000 }}
      className="absolute inset-0"
      onClick={handleGraphBackgroundClick}
    >
      {/* SVG line layer */}
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 5, pointerEvents: "none" }}>
        {guessDetails.map((detail) => {
          const guess = guessLookup.get(detail.guessId);
          const targetSelf = selfPlacements.get(detail.targetId);
          if (!guess || !targetSelf) return null;

          const lineWidth = 1 + detail.accuracy * 2;
          const strokeColor =
            activeBreakdown && detail.guesserId === activeBreakdown
              ? (colorMap.get(activeBreakdown)?.color ?? "#999")
              : (colorMap.get(detail.targetId)?.color ?? "#999");

          return (
            <line
              key={`line-${detail.guessId}`}
              x1={`${guess.guess_x * 100}%`}
              y1={`${(1 - guess.guess_y) * 100}%`}
              x2={`${targetSelf.x * 100}%`}
              y2={`${(1 - targetSelf.y) * 100}%`}
              stroke={strokeColor}
              strokeWidth={lineWidth}
              opacity={getLineOpacity(detail)}
              className="transition-opacity duration-300"
            />
          );
        })}
      </svg>

      {/* Guess dots */}
      {guessDetails.map((detail) => {
        const guess = guessLookup.get(detail.guessId);
        if (!guess) return null;

        const guessDotColor =
          activeBreakdown && detail.guesserId === activeBreakdown
            ? colorMap.get(activeBreakdown)
            : colorMap.get(detail.targetId);
        const pos = { x: guess.guess_x, y: guess.guess_y };
        const css = normalizedToPercent(pos);

        return (
          <div
            key={`gdot-${detail.guessId}`}
            className="absolute transition-opacity duration-300"
            style={{
              ...css,
              marginLeft: -resultsSizes.guessHitSize / 2,
              marginTop: -resultsSizes.guessHitSize / 2,
              width: resultsSizes.guessHitSize,
              height: resultsSizes.guessHitSize,
              zIndex: 15,
              opacity: getGuessDotOpacity(detail),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onMouseEnter={isMobile ? undefined : () => handleNetworkHover(detail.targetId)}
            onMouseLeave={isMobile ? undefined : () => handleNetworkHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (isMobile) handleNetworkTap(detail.targetId);
            }}
          >
            {detail.bestFriendBonus > 0 ? (
              <span
                className="select-none"
                style={{
                  fontSize: resultsSizes.guessDotSize * 2.5,
                  lineHeight: 1,
                  color: guessDotColor?.color ?? "#888",
                }}
                aria-label="Spectacular guess"
              >
                ★
              </span>
            ) : (
              <div
                className="rounded-full"
                style={{
                  width: resultsSizes.guessDotSize,
                  height: resultsSizes.guessDotSize,
                  backgroundColor: guessDotColor?.color,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Guess-dot labels — rendered in label layer above all dots */}
      {guessDetails.map((detail) => {
        const guess = guessLookup.get(detail.guessId);
        if (!guess) return null;

        const targetColor = colorMap.get(detail.targetId);
        const guesserName = gpLookup.get(detail.guesserId)?.display_name ?? "";
        // In score breakdown mode, point labels are in the scoreboard list — no labels on graph
        const showLabel =
          !activeBreakdown && effectiveActiveNetwork && detail.targetId === effectiveActiveNetwork;

        const css = normalizedToPercent({ x: guess.guess_x, y: guess.guess_y });
        const guessAnchor = allLabelAnchors.get(`guess-${detail.guessId}`) ?? "ne";
        const ls = resultsSizes.guesserLabel;

        return (
          <div
            key={`glbl-${detail.guessId}`}
            className="absolute pointer-events-none"
            style={{
              ...css,
              marginLeft: -resultsSizes.guessHitSize / 2,
              marginTop: -resultsSizes.guessHitSize / 2,
              width: resultsSizes.guessHitSize,
              height: resultsSizes.guessHitSize,
              zIndex: 45,
            }}
          >
            <AnimatePresence>
              {showLabel && (
                <motion.div
                  key={`glbl-m-${detail.guessId}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="font-body font-medium
                    bg-white/95 rounded shadow-sm pointer-events-none"
                  style={{
                    fontSize: ls.fontSize,
                    paddingLeft: ls.padX,
                    paddingRight: ls.padX,
                    paddingTop: ls.padY,
                    paddingBottom: ls.padY,
                    color: targetColor?.color,
                    ...resultLabelStyle(guessAnchor, resultsSizes.guessHitSize, resultsSizes.guessLabelOffset),
                  }}
                >
                  {guesserName}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Self-placement dots — interactive hit areas + visible dot circles */}
      {sortedPlayers.map((player) => {
        const selfPos = selfPlacements.get(player.gamePlayerId);
        if (!selfPos) return null;

        const color = colorMap.get(player.gamePlayerId);
        const css = normalizedToPercent(selfPos);
        const isNetworkActive = effectiveActiveNetwork === player.gamePlayerId;
        const isBreakdownActive = activeBreakdown === player.gamePlayerId;

        return (
          <div
            key={`sdot-${player.gamePlayerId}`}
            className="absolute transition-opacity duration-300"
            style={{
              ...css,
              marginLeft: -resultsSizes.selfHitSize / 2,
              marginTop: -resultsSizes.selfHitSize / 2,
              width: resultsSizes.selfHitSize,
              height: resultsSizes.selfHitSize,
              zIndex: 25,
              opacity: getSelfDotOpacity(player.gamePlayerId),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onMouseEnter={isMobile ? undefined : () => handleNetworkHover(player.gamePlayerId)}
            onMouseLeave={isMobile ? undefined : () => handleNetworkHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (isMobile) handleNetworkTap(player.gamePlayerId);
            }}
          >
            <div
              className="rounded-full transition-shadow duration-300"
              style={{
                width: resultsSizes.selfDotSize,
                height: resultsSizes.selfDotSize,
                backgroundColor: color?.color,
                border: "3px solid white",
                boxShadow: isNetworkActive || isBreakdownActive
                  ? `0 0 0 2.5px ${color?.color}, 0 0 10px ${color?.medium ?? "transparent"}`
                  : `0 0 0 1px ${color?.color}50, 0 1px 3px rgba(0,0,0,0.15)`,
              }}
            />
          </div>
        );
      })}

      {/* Label layer — rendered ABOVE all dots so labels are never obscured */}
      {sortedPlayers.map((player) => {
        const selfPos = selfPlacements.get(player.gamePlayerId);
        if (!selfPos) return null;

        const color = colorMap.get(player.gamePlayerId);
        const css = normalizedToPercent(selfPos);
        // Bonus is shown in scoreboard list in breakdown mode, not on graph
        const showBonusLabel = false;

        return (
          <div
            key={`slbl-${player.gamePlayerId}`}
            className="absolute pointer-events-none transition-opacity duration-300"
            style={{
              ...css,
              marginLeft: -resultsSizes.selfHitSize / 2,
              marginTop: -resultsSizes.selfHitSize / 2,
              width: resultsSizes.selfHitSize,
              height: resultsSizes.selfHitSize,
              zIndex: 45,
              opacity: getSelfDotOpacity(player.gamePlayerId),
            }}
          >
            {/* Always-visible name chip — positioned by cartographic algorithm */}
            <div
              className="font-display font-semibold
                bg-white/90 rounded shadow-sm"
              style={{
                fontSize: resultsSizes.placerLabel.fontSize,
                paddingLeft: resultsSizes.placerLabel.padX,
                paddingRight: resultsSizes.placerLabel.padX,
                paddingTop: resultsSizes.placerLabel.padY,
                paddingBottom: resultsSizes.placerLabel.padY,
                color: color?.color,
                ...resultLabelStyle(
                  allLabelAnchors.get(`self-${player.gamePlayerId}`) ?? "s",
                  resultsSizes.selfHitSize,
                  resultsSizes.nameLabelOffset,
                ),
              }}
            >
              {player.displayName}
            </div>

            {/* Bonus label — shown on breakdown, positioned by cartographic algorithm */}
            <AnimatePresence>
              {showBonusLabel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="font-body font-medium
                    bg-white/95 rounded shadow-sm pointer-events-none"
                  style={{
                    fontSize: resultsSizes.bonusLabel.fontSize,
                    paddingLeft: resultsSizes.bonusLabel.padX,
                    paddingRight: resultsSizes.bonusLabel.padX,
                    paddingTop: resultsSizes.bonusLabel.padY,
                    paddingBottom: resultsSizes.bonusLabel.padY,
                    color: "#171717",
                    ...resultLabelStyle(
                      allLabelAnchors.get(`bonus-${player.gamePlayerId}`) ?? "n",
                      resultsSizes.selfHitSize,
                      resultsSizes.nameLabelOffset,
                    ),
                  }}
                >
                  Bonus: +{Math.round(breakdownPlayer!.bonusPoints)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </motion.div>
  );

  // ---- Layout ----

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-0 flex-1 bg-surface">
        {/* Graph — height matches the roughly-square graph (width-constrained).
            Swipe left/right to cycle network. */}
        <div
          className="shrink-0 px-2 pt-1"
          style={{ height: "min(100vw, 60vh)" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <GameGraph
            axisXLow={game.axis_x_label_low}
            axisXHigh={game.axis_x_label_high}
            axisYLow={game.axis_y_label_low}
            axisYHigh={game.axis_y_label_high}
            graphRef={graphRef}
            sizes={sizeConfig}
          >
            {graphContent}
          </GameGraph>
        </div>

        {/* Dot indicator row — swipe affordance (explore phase only) */}
        {phase === "explore" && (
          <div className="shrink-0 flex items-center justify-center gap-2 py-2">
            {carouselOrderedPlayers.map((gp, i) => {
              const color = colorMap.get(gp.id);
              const selected = carouselIndex === i;
              return (
                <button
                  key={gp.id}
                  type="button"
                  aria-label={`Show ${gp.display_name}'s network`}
                  className="rounded-full transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: color?.color ?? "#888",
                    opacity: selected ? 1 : 0.35,
                    boxShadow: selected ? `0 0 0 2px ${color?.medium ?? "transparent"}` : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveBreakdown(null);
                    setCarouselIndex(i);
                  }}
                />
              );
            })}
            <button
              type="button"
              aria-label="Show all networks"
              className="rounded-full transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface"
              style={{
                width: 10,
                height: 10,
                backgroundColor: "#888",
                opacity: carouselIndex === carouselOrderedPlayers.length ? 1 : 0.35,
                boxShadow: carouselIndex === carouselOrderedPlayers.length ? "0 0 0 2px rgba(0,0,0,0.2)" : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveBreakdown(null);
                setCarouselIndex(carouselOrderedPlayers.length);
              }}
            />
          </div>
        )}

        {/* Scoreboard — directly below graph, scrolls independently */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4">
          {scoreboard}
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex min-h-0 flex-1 bg-surface">
      {/* Sidebar — scoreboard */}
      <div className="w-80 shrink-0 p-6 flex flex-col overflow-y-auto border-r border-black/5">
        <div className="flex-1">{scoreboard}</div>
      </div>

      {/* Graph — fills remaining space */}
      <div className="flex-1 min-h-0 p-2">
        <GameGraph
          axisXLow={game.axis_x_label_low}
          axisXHigh={game.axis_x_label_high}
          axisYLow={game.axis_y_label_low}
          axisYHigh={game.axis_y_label_high}
          graphRef={graphRef}
          sizes={sizeConfig}
        >
          {graphContent}
        </GameGraph>
      </div>
    </div>
  );
}

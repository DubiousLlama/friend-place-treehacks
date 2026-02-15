import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CONSENSUS_THRESHOLD_PCT = 70;
const MAX_AUTO_EQUIP_TAGS = 3;

/**
 * POST /api/games/[id]/award-tags
 *
 * After a game is in results phase: for each player, compute consensus
 * (average of where others placed them). If consensus is >= 70% toward
 * an axis pole, award a tag "XX% AXISNAME". If the user has <3 featured
 * tags, automatically add (equip) the awarded tag to their profile.
 * Idempotent: skips if tag for this game+axis already exists for user.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;

  const supabase = createAdminClient();

  const { data: game, error: gameErr } = await supabase
    .from("games")
    .select("id, phase, axis_x_label_low, axis_x_label_high, axis_y_label_low, axis_y_label_high")
    .eq("id", gameId)
    .single();

  if (gameErr || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.phase !== "results") {
    return NextResponse.json(
      { error: "Game must be in results phase" },
      { status: 400 }
    );
  }

  const { data: slots } = await supabase
    .from("game_players")
    .select("id, player_id, self_x, self_y")
    .eq("game_id", gameId);

  const playersWithPlacements = (slots ?? []).filter(
    (s) =>
      s.player_id != null &&
      s.self_x != null &&
      s.self_y != null
  ) as { id: string; player_id: string; self_x: number; self_y: number }[];

  const { data: guesses } = await supabase
    .from("guesses")
    .select("target_game_player_id, guess_x, guess_y")
    .eq("game_id", gameId);

  const guessesByTarget = new Map<string, { guess_x: number; guess_y: number }[]>();
  for (const g of guesses ?? []) {
    const list = guessesByTarget.get(g.target_game_player_id) ?? [];
    list.push({ guess_x: g.guess_x, guess_y: g.guess_y });
    guessesByTarget.set(g.target_game_player_id, list);
  }

  let awarded = 0;

  for (const slot of playersWithPlacements) {
    const list = guessesByTarget.get(slot.id) ?? [];
    if (list.length === 0) continue;

    const meanX =
      list.reduce((a, p) => a + p.guess_x, 0) / list.length;
    const meanY =
      list.reduce((a, p) => a + p.guess_y, 0) / list.length;

    const pctHighX = Math.round(Math.min(100, Math.max(0, meanX * 100)));
    const pctLowX = Math.round(Math.min(100, Math.max(0, (1 - meanX) * 100)));
    const pctHighY = Math.round(Math.min(100, Math.max(0, meanY * 100)));
    const pctLowY = Math.round(Math.min(100, Math.max(0, (1 - meanY) * 100)));

    const candidates: { label: string; agreement_pct: number; source_axis: "x" | "y" }[] = [];
    if (pctHighX >= CONSENSUS_THRESHOLD_PCT) {
      candidates.push({
        label: `${pctHighX}% ${game.axis_x_label_high}`,
        agreement_pct: pctHighX,
        source_axis: "x",
      });
    }
    if (pctLowX >= CONSENSUS_THRESHOLD_PCT) {
      candidates.push({
        label: `${pctLowX}% ${game.axis_x_label_low}`,
        agreement_pct: pctLowX,
        source_axis: "x",
      });
    }
    if (pctHighY >= CONSENSUS_THRESHOLD_PCT) {
      candidates.push({
        label: `${pctHighY}% ${game.axis_y_label_high}`,
        agreement_pct: pctHighY,
        source_axis: "y",
      });
    }
    if (pctLowY >= CONSENSUS_THRESHOLD_PCT) {
      candidates.push({
        label: `${pctLowY}% ${game.axis_y_label_low}`,
        agreement_pct: pctLowY,
        source_axis: "y",
      });
    }

    const { data: existingTags } = await supabase
      .from("user_featured_tags")
      .select("id, label, game_id")
      .eq("user_id", slot.player_id)
      .eq("game_id", gameId);

    const existingLabels = new Set(
      (existingTags ?? []).map((t) => `${t.game_id ?? ""}-${t.label ?? ""}`)
    );

    const { count: featuredCount } = await supabase
      .from("user_featured_tags")
      .select("id", { count: "exact", head: true })
      .eq("user_id", slot.player_id);

    const currentFeaturedCount = featuredCount ?? 0;
    const shouldEquip = currentFeaturedCount < MAX_AUTO_EQUIP_TAGS;

    let sortOrder = currentFeaturedCount;
    for (const c of candidates) {
      const key = `${gameId}-${c.label}`;
      if (existingLabels.has(key)) continue;

      if (shouldEquip) {
        await supabase.from("user_featured_tags").insert({
          user_id: slot.player_id,
          label: c.label,
          agreement_pct: c.agreement_pct,
          game_id: gameId,
          source_axis: c.source_axis,
          sort_order: sortOrder,
          awarded_at: new Date().toISOString(),
        });
        awarded++;
        sortOrder++;
        existingLabels.add(key);
      }
    }
  }

  return NextResponse.json({ ok: true, awarded });
}

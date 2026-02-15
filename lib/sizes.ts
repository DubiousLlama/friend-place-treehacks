/**
 * Configurable dot & label sizes for mobile / desktop.
 *
 * Pixel-level values are used by PlayerToken for rendering; the
 * `toNormalizedSizes` helper converts them into normalised 0–1 coordinates
 * for the label-placement algorithm so it can accurately model what the user
 * actually sees.
 */

// ---------------------------------------------------------------------------
// Pixel-level config
// ---------------------------------------------------------------------------

export interface GraphSizeConfig {
  /** Placement dot diameter (px) */
  dotSize: number;
  /** Invisible hit-area diameter — must be > dotSize (px) */
  hitSize: number;
  /** Gap from dot edge to label edge (px) */
  labelOffset: number;
  /** Label font size (px) */
  labelFontSize: number;
  /** Label horizontal padding, each side (px) */
  labelPadX: number;
  /** Label vertical padding, each side (px) */
  labelPadY: number;
  /** Tray pill height (px) */
  pillHeight: number;
  /** Tray pill font size (px) */
  pillFontSize: number;
  /** Tray pill horizontal padding, each side (px) */
  pillPadX: number;
  // --- Axis labels ---
  /** Axis label font size (px) */
  axisLabelFontSize: number;
  /** Width of side axis columns / height of top-bottom rows (px) */
  axisLabelTrack: number;
  /** Tooltip font size shown on hover / long-press (px) */
  axisTooltipFontSize: number;
}

export const MOBILE_SIZES: GraphSizeConfig = {
  dotSize: 14,
  hitSize: 28,
  labelOffset: 8,
  labelFontSize: 16,
  labelPadX: 4,   // ~px-1
  labelPadY: 1,   // ~py-px
  pillHeight: 32,
  pillFontSize: 11,
  pillPadX: 12,
  axisLabelFontSize: 12,
  axisLabelTrack: 20,
  axisTooltipFontSize: 20,
};

export const DESKTOP_SIZES: GraphSizeConfig = {
  dotSize: 18,
  hitSize: 28,
  labelOffset: 10,
  labelFontSize: 18,
  labelPadX: 6,   // ~px-1.5
  labelPadY: 2,   // ~py-0.5
  pillHeight: 36,
  pillFontSize: 12,
  pillPadX: 14,
  axisLabelFontSize: 16,
  axisLabelTrack: 24,
  axisTooltipFontSize: 24,
};

// ---------------------------------------------------------------------------
// Results view — dot & label sizes
// ---------------------------------------------------------------------------

/** Font / padding for a single label category. */
export interface LabelStyle {
  fontSize: number;
  padX: number;
  padY: number;
}

export interface ResultsSizeConfig {
  /** Self-placement dot diameter (px) — the authoritative "anchor" dot */
  selfDotSize: number;
  /** Self-placement invisible hit-area diameter (px) */
  selfHitSize: number;
  /** Guess dot diameter (px) — smaller satellite dots */
  guessDotSize: number;
  /** Guess dot invisible hit-area diameter (px) */
  guessHitSize: number;
  /** Guess label offset from dot edge (px) */
  guessLabelOffset: number;
  /** Gap from self-dot edge to name label edge (px) */
  nameLabelOffset: number;

  // ---- Per-category label styles ----
  /** Primary placer name (always-visible chip on self-dots) */
  placerLabel: LabelStyle;
  /** Guesser name (shown on guess dots during network hover) */
  guesserLabel: LabelStyle;
  /** Point value label (e.g. "+63", shown on guess dots during breakdown) */
  pointsLabel: LabelStyle;
  /** Bonus label (e.g. "Bonus: +15", shown on self-dot during breakdown) */
  bonusLabel: LabelStyle;
}

export const MOBILE_RESULTS_SIZES: ResultsSizeConfig = {
  selfDotSize: 16,
  selfHitSize: 40,
  guessDotSize: 7,
  guessHitSize: 14,
  guessLabelOffset: 6,
  nameLabelOffset: 14,
  placerLabel:  { fontSize: 16, padX: 6, padY: 2 },
  guesserLabel: { fontSize: 14, padX: 4, padY: 1 },
  pointsLabel:  { fontSize: 14, padX: 4, padY: 1 },
  bonusLabel:   { fontSize: 14, padX: 5, padY: 1 },
};

export const DESKTOP_RESULTS_SIZES: ResultsSizeConfig = {
  selfDotSize: 20,
  selfHitSize: 44,
  guessDotSize: 8,
  guessHitSize: 16,
  guessLabelOffset: 8,
  nameLabelOffset: 16,
  placerLabel:  { fontSize: 20, padX: 6, padY: 4 },
  guesserLabel: { fontSize: 13, padX: 5, padY: 4 },
  pointsLabel:  { fontSize: 13, padX: 5, padY: 4 },
  bonusLabel:   { fontSize: 13, padX: 5, padY: 4 },
};

/**
 * Convert a LabelStyle + layout offset into normalised placement sizes
 * for the cartographic algorithm.
 */
export function labelStyleToNormalized(
  label: LabelStyle,
  labelOffset: number,
  graphWidth: number,
  graphHeight: number,
): PlacementSizes {
  const lineH = label.fontSize * 1.25;
  const labelHPx = lineH + 2 * label.padY;
  const refDim = Math.min(graphWidth, graphHeight);

  return {
    labelH: labelHPx / graphHeight,
    offset: labelOffset / refDim,
    margin: 3 / refDim,
    charWidth: (label.fontSize * 0.62) / graphWidth,
    padWidth: (2 * label.padX) / graphWidth,
  };
}

/**
 * Convenience: compute normalised sizes for the primary placer label.
 * (Kept for backwards compat — the algorithm uses the largest label style
 *  for overlap detection.)
 */
export function toResultsNormalizedSizes(
  cfg: ResultsSizeConfig,
  graphWidth: number,
  graphHeight: number,
): PlacementSizes {
  return labelStyleToNormalized(cfg.placerLabel, cfg.nameLabelOffset, graphWidth, graphHeight);
}

// ---------------------------------------------------------------------------
// Normalised sizes for the placement algorithm
// ---------------------------------------------------------------------------

export interface PlacementSizes {
  /** Label height in normalised 0–1 coords */
  labelH: number;
  /** Dot-centre → label-edge gap in normalised coords */
  offset: number;
  /** Breathing-room margin for overlap detection in normalised coords */
  margin: number;
  /** Average character width in normalised coords */
  charWidth: number;
  /** Total horizontal padding (both sides) in normalised coords */
  padWidth: number;
}

/**
 * Convert pixel-level sizes into normalised placement sizes using the
 * actual measured graph dimensions.
 *
 * Call this whenever the graph resizes or the size config changes.
 */
export function toNormalizedSizes(
  cfg: GraphSizeConfig,
  graphWidth: number,
  graphHeight: number,
): PlacementSizes {
  // line-height: "leading-tight" = 1.25× font-size
  const lineH = cfg.labelFontSize * 1.25;
  const labelHPx = lineH + 2 * cfg.labelPadY;
  const refDim = Math.min(graphWidth, graphHeight);

  return {
    labelH: labelHPx / graphHeight,
    offset: cfg.labelOffset / refDim,
    margin: 3 / refDim, // 3px breathing room
    charWidth: (cfg.labelFontSize * 0.62) / graphWidth, // avg proportional char width
    padWidth: (2 * cfg.labelPadX) / graphWidth,
  };
}

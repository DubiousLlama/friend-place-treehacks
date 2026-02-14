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
  axisTooltipFontSize: 12,
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
  axisTooltipFontSize: 14,
};

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

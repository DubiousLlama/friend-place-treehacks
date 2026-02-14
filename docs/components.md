# Component Architecture

This document describes how the major UI components work and fit together.

---

## Page Flow

```
Landing page (/)
  └─ Create game form → inserts game + game_players rows → redirects to /play/[inviteCode]

Play page (/play/[inviteCode])
  ├─ Loading state
  ├─ Game not found state
  ├─ NameSelector          (user hasn't claimed a name slot yet)
  ├─ PlacingPhase + GameInfoPanel  (user claimed, hasn't submitted)
  ├─ GameDashboard         (user submitted, waiting for others)
  └─ Results (placeholder) (game.phase === "results")
```

---

## Graph Components

### `GameGraph` (`components/GameGraph.tsx`)

The 2D coordinate graph surface. Handles pan, pinch-zoom, and scroll-zoom via `@use-gesture/react`.

**Props:**
- `axisXLow`, `axisXHigh`, `axisYLow`, `axisYHigh` — axis label strings shown on the four edges.
- `children` — `PlayerToken` elements rendered inside the graph's transform layer.
- `graphRef` — a `React.RefObject<HTMLDivElement>` pointing to the inner transform layer. Passed down to tokens so they can convert pointer positions to normalized coordinates via `getBoundingClientRect()`.
- `onTransformChange?` — callback that fires whenever pan/zoom changes.

**Key internals:**
- **Layout:** CSS Grid with 3 columns × 3 rows. The center cell is the graph viewport; the 4 edge cells hold `AxisLabel` components.
- **Transform layer:** An absolutely-positioned inner `<div>` that receives CSS `translate + scale`. All tokens are children of this layer, so they pan/zoom automatically.
- **Pan clamping:** `clampPan()` ensures the graph content always fills the viewport — no white space at edges.
- **AxisLabel:** Truncated label text with a hover/long-press tooltip that shows the full text. Vertical labels use `writing-mode: vertical-rl`.

### `PlayerToken` (`components/PlayerToken.tsx`)

A draggable token that represents a player on the graph. Has two visual states:

1. **Tray pill** (`position === null`) — rounded pill with the player's name, lives in the `TokenTray`. Draggable onto the graph.
2. **Placed dot** (`position !== null`) — small colored dot at the normalized position on the graph, with a floating label anchored via the collision-avoidance algorithm.

**Props:**
- `id` — unique identifier (game_players.id).
- `label` — display text ("YOU" for self, display_name for friends).
- `variant` — `"self"` (orange/splash color) or `"friend"` (blue/accent color).
- `position` — normalized `{x, y}` where 0,0 = bottom-left and 1,1 = top-right, or `null` if unplaced.
- `onPlace(pos)` — called when the token is dropped near the graph.
- `onRemove?()` — called when the token is dragged far from the graph (returns to tray).
- `graphRef` — ref to the graph's transform layer for coordinate math.
- `labelAnchor?` — NE/NW/SE/SW direction for the label, computed by `computeLabelAnchors()`.

**Scale compensation:**
When the graph is zoomed (CSS `scale(S)`), Framer Motion's drag offset gets amplified. The token uses a compensation wrapper with `useMotionValue` to counteract this, ensuring 1:1 cursor tracking at any zoom level.

### `TokenTray` (`components/TokenTray.tsx`)

Horizontal scrollable tray at the bottom of the screen showing unplaced friend tokens. Renders `PlayerToken` components with `position={null}`. Shows "All placed! Ready to submit" when every token has been placed on the graph.

### `PlacingPhase` (`components/PlacingPhase.tsx`)

Orchestrates the full placing experience. Two-step flow:

1. **Step "self"** — user drags their own token onto the graph. A hint with the draggable "YOU" pill is shown below the graph.
2. **Step "others"** — `TokenTray` appears with all friend names. User drags each name onto the graph. A submit button appears, disabled until all names are placed.

**Props:**
- `game` — the full `Game` row.
- `currentGamePlayerId` — the user's `game_players.id`.
- `otherPlayers` — all other `GamePlayer` rows in the game.
- `onSubmit(selfPosition, guesses[])` — called when the user clicks "Submit Placements". The play page's handler writes the data to Supabase.

**State management:**
- `selfPosition` / `selfVersion` — the user's own placement. Version counter forces React remount to clear stale Framer Motion drag offsets.
- `otherPositions` / `otherVersions` — `Map<gamePlayerId, Position | null>` for each friend token.
- `labelAnchors` — recomputed via `computeLabelAnchors()` whenever any token moves.

---

## Info & Dashboard Components

### `GameInfoPanel` (`components/GameInfoPanel.tsx`)

A collapsible pull-down panel shown at the top of the graph view. Toggle button says "Game info" / "Hide info" with a rotating chevron.

**Contents when open:**
- Invite link with copy button.
- Player list with status indicators (colored dots + status text).
- Game deadline with early-end note.

Used only during graph/placing mode to keep game context accessible without leaving the graph.

### `GameDashboard` (`components/GameDashboard.tsx`)

Shown after the user has submitted their placements. A single card containing:
- Progress prompt — "Placed X of N friends" with contextual messaging.
- **Continue placing** button — takes the user back to the graph to place unguessed friends.
- **Add players** section — input field to add new unclaimed name slots to the game. After adding, the user can go to the graph to place them.
- Invite link with copy button.
- Full player list with claim/placement/submission status.
- Game deadline info.

**New props:** `guessedCount` (how many friends the user has guessed), `onContinuePlacing` (callback to switch to graph view), `onPlayersChanged` (callback to refresh after adding a player).

### `NameSelector` (`components/NameSelector.tsx`)

Shown when a user first opens a game link and hasn't claimed a name. Displays:
- List of unclaimed name slots as buttons (tap to claim).
- "I'm not on the list" option to type a new name and join.

---

## Library Modules

### `lib/game-types.ts`
Type aliases re-exported from `database.ts` plus the `Position` and `NamePlacement` interfaces used by graph components.

### `lib/graph-utils.ts`
- `pixelToNormalized(px, py, graphRect)` — converts screen pixels to 0-1 graph coordinates (Y inverted: 0 = bottom, 1 = top).
- `normalizedToPercent(pos)` — converts normalized coordinates to CSS `left`/`top` percentages for absolute positioning.
- `isWithinGraph(px, py, graphRect)` — hit test.

### `lib/label-placement.ts`
Greedy cartographic label placement. For each placed token, tries 4 anchor directions (NE, NW, SE, SW) and picks the one that is in-bounds, non-overlapping with already-placed labels, with a bias toward the natural quadrant. Labels are processed center-out.

### `lib/motion.ts`
Shared Framer Motion animation presets: `springTransition`, `tapScale`, `hoverLift`, `staggerContainer`, `staggerItem`.

---

## Coordinate System

The graph uses a **normalized 0-1 coordinate system** where:
- `(0, 0)` = bottom-left corner (axisXLow, axisYLow)
- `(1, 1)` = top-right corner (axisXHigh, axisYHigh)
- `(0.5, 0.5)` = center of graph

This is stored in the database as `self_x`, `self_y` (for self-placement) and `guess_x`, `guess_y` (for guesses). The Y axis is inverted when converting to/from CSS (`top: 0%` = top of screen = Y=1.0 in normalized space).

---

## Data Flow on Submit

1. User places tokens and clicks "Submit" (partial submission is allowed — not all friends need to be placed).
2. `PlacingPhase.onSubmit` fires with `selfPosition` and `guesses[]` (only the friends placed this session).
3. The play page's `handleSubmitPlacements` callback:
   - Updates the user's `game_players` row: `self_x`, `self_y`, `has_submitted = true`.
   - Inserts one `guesses` row per friend placed: `guesser_game_player_id`, `target_game_player_id`, `guess_x`, `guess_y`.
   - Calls `fetchAll()` to refresh state and switches to the dashboard view.
4. Realtime subscriptions keep the player list and game phase in sync across all connected clients.

## Re-entry Flow (Continue Placing)

1. From the dashboard, user clicks "Continue placing" or adds new players then clicks "Go to graph".
2. The play page fetches existing guesses from the `guesses` table to determine which friends are already placed.
3. The `PlacingPhase` receives only the **unguessed** friends as `otherPlayers`, and the user's existing self-position as `initialSelfPosition` (skips step 1).
4. On submit, only the newly placed friends are inserted as guesses (existing ones are already in the DB).
5. The view switches back to the dashboard with updated progress.

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
- `label` — display text: the user's actual display name for the self token, and `display_name` for friends (no longer "YOU").
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

1. **Step "self"** — user drags their own token onto the graph. A hint with the draggable pill (showing their display name) is shown below the graph.
2. **Step "others"** — `TokenTray` appears with all friend names. User drags each name onto the graph. Submit is enabled once self is placed (partial friend placement allowed).

**Props:**
- `game` — the full `Game` row.
- `currentGamePlayerId` — the user's `game_players.id`.
- `currentDisplayName` — the user's display name (shown on their token instead of "YOU").
- `otherPlayers` — all other `GamePlayer` rows in the game.
- `initialSelfPosition` — optional; when re-entering after a previous submit, pre-fills self position.
- `initialOtherPositions` — optional `Map<gamePlayerId, Position>` of existing guesses for re-entry.
- `onSubmit(selfPosition, guesses[])` — called when the user clicks "Submit". The play page handler writes to Supabase.

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
- Player list: for each player, status shows placement progress (e.g. "3/5" for how many friends they've placed). For the current user: **edit** (change display name, same identity) and **switch** (release slot and pick a different name). Inline edit with Save/Cancel when editing name.
- Game deadline with early-end note.
- **Host only:** "End game & reveal results" button (with confirmation).

**Props:** `game`, `gamePlayers`, `mySlot`, `inviteCode`, `guessedCount`, `onUnclaim`, `onEditName`, `isHost`, `onEndGame`.

Used only during graph/placing mode to keep game context accessible without leaving the graph.

### `GameDashboard` (`components/GameDashboard.tsx`)

Shown after the user has submitted their placements. A single card containing:
- Progress prompt — "Placed X of N friends" with contextual messaging.
- **Edit name** and **Switch name** — Edit updates the display name for the same claimed slot; Switch releases the slot so the user can pick a different identity (opens NameSelector). Inline edit with Save/Cancel when editing.
- **Continue placing** button — takes the user back to the graph to place unguessed friends.
- **Add players** section — input field to add new unclaimed name slots. After adding, user can go to the graph to place them.
- Invite link with copy button.
- Full player list: for the current user, status is "X/N placed"; for others, the host (and everyone) sees **placement count** (e.g. "2/4 placed") from `game_players.guesses_count`, not just "Submitted" or "Joined".
- Game deadline info.
- **Host only:** "End game & reveal results" button (with confirmation).

**Props:** `game`, `gamePlayers`, `mySlot`, `currentPlayerId`, `inviteCode`, `guessedCount`, `onContinuePlacing`, `onPlayersChanged`, `onUnclaim`, `onEditName`, `isHost`, `onEndGame`.

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

1. User places tokens and clicks "Submit" (partial submission allowed — only self must be placed).
2. `PlacingPhase.onSubmit` fires with `selfPosition` and `guesses[]` (all friends currently placed on the graph, including any previously placed).
3. The play page's `handleSubmitPlacements` callback:
   - Updates the user's `game_players` row: `self_x`, `self_y`, `has_submitted = true`, `guesses_count = guesses.length`.
   - Deletes all existing `guesses` rows for this user for this game, then inserts the current `guesses[]` (delete + re-insert so moves and new placements are persisted).
   - Calls `fetchAll()` and switches view to dashboard.
4. Realtime keeps the player list and game phase in sync.

## Re-entry Flow (Continue Placing)

1. From the dashboard, user clicks "Continue placing" or adds new players then "Go to graph".
2. The play page fetches `myGuesses` from the `guesses` table and builds `initialOtherPositions`.
3. `PlacingPhase` receives **all** other players as `otherPlayers` and `initialOtherPositions` so previously placed friends appear on the graph and can be moved; unplaced friends stay in the tray.
4. On submit, the same delete-all-guesses + insert-current flow runs; `guesses_count` is updated.
5. View switches back to dashboard with updated progress.

## Name Identity: Edit vs Switch

- **Edit name** — Change the display name of the slot you've already claimed (same identity). Updates `game_players.display_name`; must stay unique per game.
- **Switch name** — Release your slot (`player_id` and placement data cleared, your guesses deleted) and return to the name picker to claim a different name.

## Schema / Migrations (relevant to components)

- **`game_players.guesses_count`** — Denormalized count of how many friends this player has placed (updated on submit). Used so the host and everyone can see "X/N placed" without reading the `guesses` table (RLS restricts guess reads).
- **Host controls** — Game creator can update the game (e.g. set `phase = 'results'`). RLS: "Creator can update game" on `games`. Host sees "End game & reveal results" in dashboard and info panel.
- **Unclaim** — RLS on `game_players` allows setting `player_id = NULL` on your own row (migration `20260214200000_allow_unclaim.sql`).

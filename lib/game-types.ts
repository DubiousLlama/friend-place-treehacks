import type { Database } from "@/lib/types/database";

type Tables = Database["public"]["Tables"];

export type Game = Tables["games"]["Row"];
export type GamePlayer = Tables["game_players"]["Row"];
export type Guess = Tables["guesses"]["Row"];
export type GamePhase = Database["public"]["Enums"]["game_phase"];

/** Normalized 0-1 coordinate */
export interface Position {
  x: number;
  y: number;
}

/** A name-slot token with its current placement (null = unplaced, still in tray) */
export interface NamePlacement {
  gamePlayer: GamePlayer;
  position: Position | null;
}

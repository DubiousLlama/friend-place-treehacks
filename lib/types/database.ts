/**
 * Auto-generated Supabase Database types.
 *
 * Replace this file by running:
 *   npx supabase gen types typescript --project-id <project-ref> > lib/types/database.ts
 *
 * The placeholder below matches the schema from the initial migration so
 * that imports compile before the real types are generated.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          invite_code: string;
          axis_x_label_low: string;
          axis_x_label_high: string;
          axis_y_label_low: string;
          axis_y_label_high: string;
          phase: "lobby" | "placing" | "results";
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          invite_code: string;
          axis_x_label_low: string;
          axis_x_label_high: string;
          axis_y_label_low: string;
          axis_y_label_high: string;
          phase?: "lobby" | "placing" | "results";
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          invite_code?: string;
          axis_x_label_low?: string;
          axis_x_label_high?: string;
          axis_y_label_low?: string;
          axis_y_label_high?: string;
          phase?: "lobby" | "placing" | "results";
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      game_players: {
        Row: {
          id: string;
          game_id: string;
          player_id: string;
          display_name: string;
          self_x: number | null;
          self_y: number | null;
          has_submitted: boolean;
          score: number | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_id: string;
          display_name: string;
          self_x?: number | null;
          self_y?: number | null;
          has_submitted?: boolean;
          score?: number | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          player_id?: string;
          display_name?: string;
          self_x?: number | null;
          self_y?: number | null;
          has_submitted?: boolean;
          score?: number | null;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_players_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      guesses: {
        Row: {
          id: string;
          game_id: string;
          guesser_id: string;
          target_id: string;
          guess_x: number;
          guess_y: number;
        };
        Insert: {
          id?: string;
          game_id: string;
          guesser_id: string;
          target_id: string;
          guess_x: number;
          guess_y: number;
        };
        Update: {
          id?: string;
          game_id?: string;
          guesser_id?: string;
          target_id?: string;
          guess_x?: number;
          guess_y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "guesses_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guesses_guesser_id_fkey";
            columns: ["guesser_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guesses_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      game_phase: "lobby" | "placing" | "results";
    };
    CompositeTypes: Record<string, never>;
  };
};

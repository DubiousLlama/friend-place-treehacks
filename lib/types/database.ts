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
          linked_at: string | null;
          onboarding_plays_seen: number;
          phone: string | null;
          notifications_enabled: boolean;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          linked_at?: string | null;
          onboarding_plays_seen?: number;
          phone?: string | null;
          notifications_enabled?: boolean;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          linked_at?: string | null;
          onboarding_plays_seen?: number;
          phone?: string | null;
          notifications_enabled?: boolean;
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
          phase: "placing" | "results";
          created_by: string;
          created_at: string;
          submissions_lock_at: string | null;
          end_early_when_complete: boolean;
        };
        Insert: {
          id?: string;
          invite_code: string;
          axis_x_label_low: string;
          axis_x_label_high: string;
          axis_y_label_low: string;
          axis_y_label_high: string;
          phase?: "placing" | "results";
          created_by: string;
          created_at?: string;
          submissions_lock_at?: string | null;
          end_early_when_complete?: boolean;
        };
        Update: {
          id?: string;
          invite_code?: string;
          axis_x_label_low?: string;
          axis_x_label_high?: string;
          axis_y_label_low?: string;
          axis_y_label_high?: string;
          phase?: "placing" | "results";
          created_by?: string;
          created_at?: string;
          submissions_lock_at?: string | null;
          end_early_when_complete?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      game_players: {
        Row: {
          id: string;
          game_id: string;
          player_id: string | null;
          display_name: string;
          self_x: number | null;
          self_y: number | null;
          has_submitted: boolean;
          score: number | null;
          claimed_at: string | null;
          guesses_count: number;
          results_viewed_at: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_id?: string | null;
          display_name: string;
          self_x?: number | null;
          self_y?: number | null;
          has_submitted?: boolean;
          score?: number | null;
          claimed_at?: string | null;
          guesses_count?: number;
          results_viewed_at?: string | null;
        };
        Update: {
          id?: string;
          game_id?: string;
          player_id?: string | null;
          display_name?: string;
          self_x?: number | null;
          self_y?: number | null;
          has_submitted?: boolean;
          score?: number | null;
          claimed_at?: string | null;
          guesses_count?: number;
          results_viewed_at?: string | null;
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
          },
        ];
      };
      guesses: {
        Row: {
          id: string;
          game_id: string;
          guesser_game_player_id: string;
          target_game_player_id: string;
          guess_x: number;
          guess_y: number;
        };
        Insert: {
          id?: string;
          game_id: string;
          guesser_game_player_id: string;
          target_game_player_id: string;
          guess_x: number;
          guess_y: number;
        };
        Update: {
          id?: string;
          game_id?: string;
          guesser_game_player_id?: string;
          target_game_player_id?: string;
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
            foreignKeyName: "guesses_guesser_game_player_id_fkey";
            columns: ["guesser_game_player_id"];
            isOneToOne: false;
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guesses_target_game_player_id_fkey";
            columns: ["target_game_player_id"];
            isOneToOne: false;
            referencedRelation: "game_players";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_axes: {
        Row: {
          id: string;
          date: string;
          axis_x_label_low: string;
          axis_x_label_high: string;
          axis_y_label_low: string;
          axis_y_label_high: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          date?: string;
          axis_x_label_low: string;
          axis_x_label_high: string;
          axis_y_label_low: string;
          axis_y_label_high: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          axis_x_label_low?: string;
          axis_x_label_high?: string;
          axis_y_label_low?: string;
          axis_y_label_high?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      saved_groups: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_groups_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_group_members: {
        Row: {
          id: string;
          group_id: string;
          display_name: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          display_name: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          group_id?: string;
          display_name?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "saved_group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "saved_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_log: {
        Row: {
          id: string;
          player_id: string;
          game_id: string | null;
          kind: string;
          channel: string;
          sent_at: string;
          message: string | null;
        };
        Insert: {
          id?: string;
          player_id: string;
          game_id?: string | null;
          kind: string;
          channel: string;
          sent_at?: string;
          message?: string | null;
        };
        Update: {
          id?: string;
          player_id?: string;
          game_id?: string | null;
          kind?: string;
          channel?: string;
          sent_at?: string;
          message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_log_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_log_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_and_end_game: {
        Args: {
          p_game_id: string;
          p_force?: boolean;
        };
        Returns: Json;
      };
    };
    Enums: {
      game_phase: "placing" | "results";
    };
    CompositeTypes: Record<string, never>;
  };
};

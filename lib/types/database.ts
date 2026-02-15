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
          group_id: string | null;
          deleted_at: string | null;
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
          group_id?: string | null;
          deleted_at?: string | null;
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
          group_id?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "saved_groups";
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
          invited_email: string | null;
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
          invited_email?: string | null;
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
          invited_email?: string | null;
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
      device_daily_usage: {
        Row: {
          device_key: string;
          date: string;
          axes_generation_count: number;
          invite_email_count: number;
          user_agent: string | null;
          ip_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          device_key: string;
          date: string;
          axes_generation_count?: number;
          invite_email_count?: number;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          device_key?: string;
          date?: string;
          axes_generation_count?: number;
          invite_email_count?: number;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_groups: {
        Row: {
          id: string;
          owner_id: string;
          name: string | null;
          created_at: string;
          anyone_can_add_members: boolean;
          only_admin_can_remove: boolean;
          daily_game_enabled: boolean;
          interests: string[];
        };
        Insert: {
          id?: string;
          owner_id: string;
          name?: string | null;
          created_at?: string;
          anyone_can_add_members?: boolean;
          only_admin_can_remove?: boolean;
          daily_game_enabled?: boolean;
          interests?: string[];
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string | null;
          created_at?: string;
          anyone_can_add_members?: boolean;
          only_admin_can_remove?: boolean;
          daily_game_enabled?: boolean;
          interests?: string[];
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
      group_members: {
        Row: {
          id: string;
          group_id: string;
          player_id: string | null;
          anonymous_display_name: string | null;
          is_anonymous: boolean;
          sort_order: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          player_id?: string | null;
          anonymous_display_name?: string | null;
          is_anonymous?: boolean;
          sort_order?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          player_id?: string | null;
          anonymous_display_name?: string | null;
          is_anonymous?: boolean;
          sort_order?: number;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "saved_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      email_invites: {
        Row: {
          id: string;
          target_type: "group" | "game";
          target_id: string;
          email: string;
          token: string;
          invited_by: string;
          created_at: string;
          expires_at: string;
          suggested_display_name: string | null;
        };
        Insert: {
          id?: string;
          target_type: "group" | "game";
          target_id: string;
          email: string;
          token: string;
          invited_by: string;
          created_at?: string;
          expires_at: string;
          suggested_display_name?: string | null;
        };
        Update: {
          id?: string;
          target_type?: "group" | "game";
          target_id?: string;
          email?: string;
          token?: string;
          invited_by?: string;
          created_at?: string;
          expires_at?: string;
          suggested_display_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
        ];
      };
      user_featured_tags: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          agreement_pct: number;
          game_id: string | null;
          source_axis: "x" | "y" | null;
          sort_order: number;
          created_at: string;
          awarded_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          agreement_pct: number;
          game_id?: string | null;
          source_axis?: "x" | "y" | null;
          sort_order?: number;
          created_at?: string;
          awarded_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          agreement_pct?: number;
          game_id?: string | null;
          source_axis?: "x" | "y" | null;
          sort_order?: number;
          created_at?: string;
          awarded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_featured_tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_featured_tags_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
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
      soft_delete_game: {
        Args: { p_game_id: string };
        Returns: unknown;
      };
      check_game_invite_status: {
        Args: { p_invite_code: string };
        Returns: string | null;
      };
      increment_device_axes: {
        Args: { p_device_key: string; p_date: string };
        Returns: unknown;
      };
      increment_device_invites: {
        Args: { p_device_key: string; p_date: string; p_count: number };
        Returns: unknown;
      };
    };
    Enums: {
      game_phase: "placing" | "results";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      goals: {
        Row: {
          created_at: string
          id: string
          match_id: string
          player_id: string
          team_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          player_id: string
          team_number: number
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
          team_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          created_at: string
          id: string
          league_id: string
          role: Database["public"]["Enums"]["league_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id: string
          role?: Database["public"]["Enums"]["league_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string
          role?: Database["public"]["Enums"]["league_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          password: string | null
          points_attendance: number
          points_penalty_loss: number
          points_penalty_win: number
          points_win: number
          team_colors: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          password?: string | null
          points_attendance?: number
          points_penalty_loss?: number
          points_penalty_win?: number
          points_win?: number
          team_colors?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          password?: string | null
          points_attendance?: number
          points_penalty_loss?: number
          points_penalty_win?: number
          points_win?: number
          team_colors?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      match_participants: {
        Row: {
          brings_beer: boolean
          combined_rating: number | null
          created_at: string
          id: string
          is_absent: boolean
          is_present: boolean | null
          match_id: string
          player_id: string
          position: Database["public"]["Enums"]["player_position"]
          team_number: number | null
          updated_at: string
        }
        Insert: {
          brings_beer?: boolean
          combined_rating?: number | null
          created_at?: string
          id?: string
          is_absent?: boolean
          is_present?: boolean | null
          match_id: string
          player_id: string
          position: Database["public"]["Enums"]["player_position"]
          team_number?: number | null
          updated_at?: string
        }
        Update: {
          brings_beer?: boolean
          combined_rating?: number | null
          created_at?: string
          id?: string
          is_absent?: boolean
          is_present?: boolean | null
          match_id?: string
          player_id?: string
          position?: Database["public"]["Enums"]["player_position"]
          team_number?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          created_at: string
          goals_scored: number
          id: string
          match_id: string
          team_number: number
          updated_at: string
          win_type: string | null
        }
        Insert: {
          created_at?: string
          goals_scored?: number
          id?: string
          match_id: string
          team_number: number
          updated_at?: string
          win_type?: string | null
        }
        Update: {
          created_at?: string
          goals_scored?: number
          id?: string
          match_id?: string
          team_number?: number
          updated_at?: string
          win_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_completed: boolean
          league_id: string
          location: string | null
          match_date: string
          match_time: string
          max_goalkeepers: number | null
          max_participants: number | null
          max_players: number | null
          notes: string | null
          number_of_teams: number
          points_attendance: number | null
          points_penalty_loss: number | null
          points_penalty_win: number | null
          points_win: number | null
          season_id: string | null
          signups_locked: boolean
          team_algorithm: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_completed?: boolean
          league_id: string
          location?: string | null
          match_date: string
          match_time: string
          max_goalkeepers?: number | null
          max_participants?: number | null
          max_players?: number | null
          notes?: string | null
          number_of_teams: number
          points_attendance?: number | null
          points_penalty_loss?: number | null
          points_penalty_win?: number | null
          points_win?: number | null
          season_id?: string | null
          signups_locked?: boolean
          team_algorithm?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_completed?: boolean
          league_id?: string
          location?: string | null
          match_date?: string
          match_time?: string
          max_goalkeepers?: number | null
          max_participants?: number | null
          max_players?: number | null
          notes?: string | null
          number_of_teams?: number
          points_attendance?: number | null
          points_penalty_loss?: number | null
          points_penalty_win?: number | null
          points_win?: number | null
          season_id?: string | null
          signups_locked?: boolean
          team_algorithm?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          created_at: string
          id: string
          rated_player_id: string
          rater_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          rated_player_id: string
          rater_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          rated_player_id?: string
          rater_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          location: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          location?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          location?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rating_aggregates: {
        Row: {
          average_rating: number | null
          beers_brought: number
          player_id: string
          sum_ratings: number | null
          total_ratings: number | null
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          beers_brought?: number
          player_id: string
          sum_ratings?: number | null
          total_ratings?: number | null
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          beers_brought?: number
          player_id?: string
          sum_ratings?: number | null
          total_ratings?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      saves: {
        Row: {
          created_at: string
          id: string
          match_id: string
          player_id: string
          saves_count: number
          team_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          player_id: string
          saves_count?: number
          team_number: number
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
          saves_count?: number
          team_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "saves_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          league_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          league_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          league_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "public_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_leagues: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          has_password: boolean | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          has_password?: never
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          has_password?: never
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_league_role: {
        Args: {
          _league_id: string
          _role: Database["public"]["Enums"]["league_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_league_admin: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      is_league_member: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "paid_member" | "unpaid_member"
      league_role: "admin" | "plačan_član" | "neplačan_član"
      player_position: "igralec" | "vratar"
      user_role: "neplačan_član" | "administrator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "paid_member", "unpaid_member"],
      league_role: ["admin", "plačan_član", "neplačan_član"],
      player_position: ["igralec", "vratar"],
      user_role: ["neplačan_član", "administrator"],
    },
  },
} as const

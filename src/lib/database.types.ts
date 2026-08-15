export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      league_interests: {
        Row: {
          created_at: string | null
          division: string
          experience_level: string
          id: string
          league_id: string
          player_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          division: string
          experience_level: string
          id?: string
          league_id: string
          player_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          division?: string
          experience_level?: string
          id?: string
          league_id?: string
          player_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'league_interests_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_interests_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_interests_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
        ]
      }
      league_matches: {
        Row: {
          created_at: string
          division: string
          id: string
          league_id: string
          location: string | null
          played_on: string | null
          set_scores: Json | null
          stage: string
          team1_id: string | null
          team2_id: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          division: string
          id?: string
          league_id: string
          location?: string | null
          played_on?: string | null
          set_scores?: Json | null
          stage: string
          team1_id?: string | null
          team2_id?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          division?: string
          id?: string
          league_id?: string
          location?: string | null
          played_on?: string | null
          set_scores?: Json | null
          stage?: string
          team1_id?: string | null
          team2_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'league_matches_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_matches_team1_id_fkey'
            columns: ['team1_id']
            isOneToOne: false
            referencedRelation: 'league_teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_matches_team2_id_fkey'
            columns: ['team2_id']
            isOneToOne: false
            referencedRelation: 'league_teams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_matches_winner_id_fkey'
            columns: ['winner_id']
            isOneToOne: false
            referencedRelation: 'league_teams'
            referencedColumns: ['id']
          },
        ]
      }
      league_teams: {
        Row: {
          created_at: string
          division: string
          experience_level: string
          group_label: string | null
          id: string
          league_id: string
          player1_id: string
          player2_id: string
          preferred_play_times: string | null
          spirit_animal: string | null
          team_name: string | null
          team_song: string | null
        }
        Insert: {
          created_at?: string
          division: string
          experience_level: string
          group_label?: string | null
          id?: string
          league_id: string
          player1_id: string
          player2_id: string
          preferred_play_times?: string | null
          spirit_animal?: string | null
          team_name?: string | null
          team_song?: string | null
        }
        Update: {
          created_at?: string
          division?: string
          experience_level?: string
          group_label?: string | null
          id?: string
          league_id?: string
          player1_id?: string
          player2_id?: string
          preferred_play_times?: string | null
          spirit_animal?: string | null
          team_name?: string | null
          team_song?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'league_teams_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_teams_player1_id_fkey'
            columns: ['player1_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_teams_player1_id_fkey'
            columns: ['player1_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_teams_player2_id_fkey'
            columns: ['player2_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_teams_player2_id_fkey'
            columns: ['player2_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string | null
          created_by: string | null
          description_md: string | null
          description_sections: Json | null
          divisions: string[] | null
          ends_at: string | null
          finals_end: string | null
          finals_start: string | null
          group_stage_end: string | null
          group_stage_start: string | null
          id: string
          name: string
          quarters_end: string | null
          quarters_start: string | null
          semis_end: string | null
          semis_start: string | null
          signup_closes_at: string | null
          starts_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description_md?: string | null
          description_sections?: Json | null
          divisions?: string[] | null
          ends_at?: string | null
          finals_end?: string | null
          finals_start?: string | null
          group_stage_end?: string | null
          group_stage_start?: string | null
          id?: string
          name: string
          quarters_end?: string | null
          quarters_start?: string | null
          semis_end?: string | null
          semis_start?: string | null
          signup_closes_at?: string | null
          starts_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description_md?: string | null
          description_sections?: Json | null
          divisions?: string[] | null
          ends_at?: string | null
          finals_end?: string | null
          finals_start?: string | null
          group_stage_end?: string | null
          group_stage_start?: string | null
          id?: string
          name?: string
          quarters_end?: string | null
          quarters_start?: string | null
          semis_end?: string | null
          semis_start?: string | null
          signup_closes_at?: string | null
          starts_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'leagues_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'leagues_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
        ]
      }
      lobster_oscars_categories: {
        Row: {
          created_at: string
          display_order: number
          icon: string
          id: string
          name: string
          session_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          name: string
          session_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string
          id?: string
          name?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lobster_oscars_categories_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'lobster_oscars_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      lobster_oscars_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          shared_at: string | null
          started_at: string | null
          tournament_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          shared_at?: string | null
          started_at?: string | null
          tournament_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          shared_at?: string | null
          started_at?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lobster_oscars_sessions_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: true
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      lobster_oscars_votes: {
        Row: {
          category_id: string
          created_at: string
          id: string
          target_id: string
          updated_at: string
          voter_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          target_id: string
          updated_at?: string
          voter_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          target_id?: string
          updated_at?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lobster_oscars_votes_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'lobster_oscars_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lobster_oscars_votes_target_id_fkey'
            columns: ['target_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lobster_oscars_votes_target_id_fkey'
            columns: ['target_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lobster_oscars_votes_voter_id_fkey'
            columns: ['voter_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lobster_oscars_votes_voter_id_fkey'
            columns: ['voter_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          completed: boolean | null
          court: string | null
          created_at: string | null
          id: string
          round: number | null
          score1: number | null
          score2: number | null
          team1_ids: string[] | null
          team1_level: number | null
          team2_ids: string[] | null
          team2_level: number | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          completed?: boolean | null
          court?: string | null
          created_at?: string | null
          id?: string
          round?: number | null
          score1?: number | null
          score2?: number | null
          team1_ids?: string[] | null
          team1_level?: number | null
          team2_ids?: string[] | null
          team2_level?: number | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          completed?: boolean | null
          court?: string | null
          created_at?: string | null
          id?: string
          round?: number | null
          score1?: number | null
          score2?: number | null
          team1_ids?: string[] | null
          team1_level?: number | null
          team2_ids?: string[] | null
          team2_level?: number | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'matches_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      merch_interests: {
        Row: {
          admin_comment: string | null
          cancelled_at: string | null
          created_at: string | null
          custom_name: string | null
          delivered: boolean | null
          display_order: number | null
          id: number
          merch_item_id: number | null
          paid: boolean | null
          player_id: string | null
          size: string | null
          status: string | null
        }
        Insert: {
          admin_comment?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          custom_name?: string | null
          delivered?: boolean | null
          display_order?: number | null
          id?: number
          merch_item_id?: number | null
          paid?: boolean | null
          player_id?: string | null
          size?: string | null
          status?: string | null
        }
        Update: {
          admin_comment?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          custom_name?: string | null
          delivered?: boolean | null
          display_order?: number | null
          id?: number
          merch_item_id?: number | null
          paid?: boolean | null
          player_id?: string | null
          size?: string | null
          status?: string | null
        }
        Relationships: []
      }
      merch_items: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          external_orders: number
          id: number
          image_url: string | null
          image_urls: Json | null
          name: string
          price: number | null
          sizes: string[] | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          external_orders?: number
          id?: number
          image_url?: string | null
          image_urls?: Json | null
          name: string
          price?: number | null
          sizes?: string[] | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          external_orders?: number
          id?: number
          image_url?: string | null
          image_urls?: Json | null
          name?: string
          price?: number | null
          sizes?: string[] | null
        }
        Relationships: []
      }
      pin_attempts: {
        Row: {
          attempt_kind: string
          attempted_at: string
          device_id: string | null
          id: number
          ip_address: unknown
          player_id: string | null
          succeeded: boolean
          user_agent: string | null
        }
        Insert: {
          attempt_kind: string
          attempted_at?: string
          device_id?: string | null
          id?: number
          ip_address?: unknown
          player_id?: string | null
          succeeded: boolean
          user_agent?: string | null
        }
        Update: {
          attempt_kind?: string
          attempted_at?: string
          device_id?: string | null
          id?: number
          ip_address?: unknown
          player_id?: string | null
          succeeded?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      player_aliases: {
        Row: {
          created_at: string
          historical_name: string
          player_id: string | null
          skipped: boolean
        }
        Insert: {
          created_at?: string
          historical_name: string
          player_id?: string | null
          skipped?: boolean
        }
        Update: {
          created_at?: string
          historical_name?: string
          player_id?: string | null
          skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'player_aliases_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'player_aliases_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
        ]
      }
      player_email_clears: {
        Row: {
          cleared_at: string
          cleared_by: string | null
          cleared_via: string
          id: number
          old_email: string
          player_id: string
        }
        Insert: {
          cleared_at?: string
          cleared_by?: string | null
          cleared_via: string
          id?: never
          old_email: string
          player_id: string
        }
        Update: {
          cleared_at?: string
          cleared_by?: string | null
          cleared_via?: string
          id?: never
          old_email?: string
          player_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          adjusted_level: number | null
          adjustment: number | null
          avatar_url: string | null
          birthday: string | null
          country: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          is_left_handed: boolean | null
          learned_matches_count: number
          learned_rating: number | null
          learned_rd: number | null
          learned_updated_at: string | null
          learned_volatility: number | null
          mm_rating: number | null
          mm_rating_updated_at: string | null
          mm_sigma: number | null
          name: string
          notes: string | null
          phone: string | null
          pin: string | null
          pin_changes: number
          pin_hash: string | null
          playtomic_level: number | null
          playtomic_updated_at: string | null
          playtomic_username: string | null
          preferred_position: string | null
          role: Database['public']['Enums']['player_role']
          status: string | null
          tagline: string | null
          tagline_label: string | null
        }
        Insert: {
          adjusted_level?: number | null
          adjustment?: number | null
          avatar_url?: string | null
          birthday?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          is_left_handed?: boolean | null
          learned_matches_count?: number
          learned_rating?: number | null
          learned_rd?: number | null
          learned_updated_at?: string | null
          learned_volatility?: number | null
          mm_rating?: number | null
          mm_rating_updated_at?: string | null
          mm_sigma?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          pin?: string | null
          pin_changes?: number
          pin_hash?: string | null
          playtomic_level?: number | null
          playtomic_updated_at?: string | null
          playtomic_username?: string | null
          preferred_position?: string | null
          role?: Database['public']['Enums']['player_role']
          status?: string | null
          tagline?: string | null
          tagline_label?: string | null
        }
        Update: {
          adjusted_level?: number | null
          adjustment?: number | null
          avatar_url?: string | null
          birthday?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          is_left_handed?: boolean | null
          learned_matches_count?: number
          learned_rating?: number | null
          learned_rd?: number | null
          learned_updated_at?: string | null
          learned_volatility?: number | null
          mm_rating?: number | null
          mm_rating_updated_at?: string | null
          mm_sigma?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          pin?: string | null
          pin_changes?: number
          pin_hash?: string | null
          playtomic_level?: number | null
          playtomic_updated_at?: string | null
          playtomic_username?: string | null
          preferred_position?: string | null
          role?: Database['public']['Enums']['player_role']
          status?: string | null
          tagline?: string | null
          tagline_label?: string | null
        }
        Relationships: []
      }
      raffle_exclusions: {
        Row: {
          created_at: string
          player_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          player_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          player_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'raffle_exclusions_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'raffle_exclusions_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'raffle_exclusions_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      raffle_winners: {
        Row: {
          cooldown_offset: number
          created_at: string
          id: string
          player_id: string
          prize: string | null
          tournament_id: string | null
          tournament_label: string | null
          won_at_date: string
        }
        Insert: {
          cooldown_offset?: number
          created_at?: string
          id?: string
          player_id: string
          prize?: string | null
          tournament_id?: string | null
          tournament_label?: string | null
          won_at_date: string
        }
        Update: {
          cooldown_offset?: number
          created_at?: string
          id?: string
          player_id?: string
          prize?: string | null
          tournament_id?: string | null
          tournament_label?: string | null
          won_at_date?: string
        }
        Relationships: [
          {
            foreignKeyName: 'raffle_winners_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'raffle_winners_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'raffle_winners_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      rating_events: {
        Row: {
          applied_delta: number
          breakdown: Json
          created_at: string | null
          flagged: boolean
          id: string
          kind: string
          player_id: string
          prior_mu: number
          prior_sigma: number
          proposed_delta: number
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          tournament_id: string | null
        }
        Insert: {
          applied_delta: number
          breakdown: Json
          created_at?: string | null
          flagged?: boolean
          id?: string
          kind?: string
          player_id: string
          prior_mu: number
          prior_sigma: number
          proposed_delta: number
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          tournament_id?: string | null
        }
        Update: {
          applied_delta?: number
          breakdown?: Json
          created_at?: string | null
          flagged?: boolean
          id?: string
          kind?: string
          player_id?: string
          prior_mu?: number
          prior_sigma?: number
          proposed_delta?: number
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'rating_events_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rating_events_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rating_events_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      registration_status_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: number
          new_status: string | null
          old_status: string | null
          player_id: string
          registration_id: string
          source: string
          tournament_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: never
          new_status?: string | null
          old_status?: string | null
          player_id: string
          registration_id: string
          source?: string
          tournament_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: never
          new_status?: string | null
          old_status?: string | null
          player_id?: string
          registration_id?: string
          source?: string
          tournament_id?: string
        }
        Relationships: []
      }
      registration_transfers: {
        Row: {
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          from_player_id: string
          id: string
          responded_at: string | null
          status: string
          to_player_id: string
          tournament_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          from_player_id: string
          id?: string
          responded_at?: string | null
          status?: string
          to_player_id: string
          tournament_id: string
        }
        Update: {
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          from_player_id?: string
          id?: string
          responded_at?: string | null
          status?: string
          to_player_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'registration_transfers_from_player_id_fkey'
            columns: ['from_player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registration_transfers_from_player_id_fkey'
            columns: ['from_player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registration_transfers_to_player_id_fkey'
            columns: ['to_player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registration_transfers_to_player_id_fkey'
            columns: ['to_player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registration_transfers_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      registrations: {
        Row: {
          created_at: string | null
          id: string
          payment_method: string | null
          payment_status: string | null
          player_id: string
          status: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          player_id: string
          status?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          player_id?: string
          status?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'registrations_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registrations_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'registrations_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      schedule_runs: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          report: Json
          seed: number
          tournament_id: string
        }
        Insert: {
          config: Json
          created_at?: string | null
          id?: string
          report: Json
          seed: number
          tournament_id: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          report?: Json
          seed?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'schedule_runs_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      settings: {
        Row: {
          group_name: string | null
          id: number
          lobster_way_content: Json | null
          padel_tips: Json | null
          raffle_cooldown_tournaments: number
          whatsapp_link: string | null
        }
        Insert: {
          group_name?: string | null
          id?: number
          lobster_way_content?: Json | null
          padel_tips?: Json | null
          raffle_cooldown_tournaments?: number
          whatsapp_link?: string | null
        }
        Update: {
          group_name?: string | null
          id?: number
          lobster_way_content?: Json | null
          padel_tips?: Json | null
          raffle_cooldown_tournaments?: number
          whatsapp_link?: string | null
        }
        Relationships: []
      }
      tournament_reminders_sent: {
        Row: {
          error: string | null
          net_request_id: number | null
          player_id: string
          sent_at: string
          status: string
          tournament_id: string
        }
        Insert: {
          error?: string | null
          net_request_id?: number | null
          player_id: string
          sent_at?: string
          status?: string
          tournament_id: string
        }
        Update: {
          error?: string | null
          net_request_id?: number | null
          player_id?: string
          sent_at?: string
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_reminders_sent_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_reminders_sent_player_id_fkey'
            columns: ['player_id']
            isOneToOne: false
            referencedRelation: 'players_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_reminders_sent_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      tournaments: {
        Row: {
          completed_at: string | null
          courts: Json | null
          created_at: string | null
          date: string | null
          duration: number | null
          format: string | null
          gender_mode: string | null
          id: string
          location: string | null
          max_players: number
          name: string
          notes: string | null
          prize_item_ids: number[] | null
          raffle_published_at: string | null
          ratings_applied_at: string | null
          results_shared_at: string | null
          status: string | null
          tikkie_link: string | null
          time: string | null
          total_price: number | null
        }
        Insert: {
          completed_at?: string | null
          courts?: Json | null
          created_at?: string | null
          date?: string | null
          duration?: number | null
          format?: string | null
          gender_mode?: string | null
          id?: string
          location?: string | null
          max_players?: number
          name: string
          notes?: string | null
          prize_item_ids?: number[] | null
          raffle_published_at?: string | null
          ratings_applied_at?: string | null
          results_shared_at?: string | null
          status?: string | null
          tikkie_link?: string | null
          time?: string | null
          total_price?: number | null
        }
        Update: {
          completed_at?: string | null
          courts?: Json | null
          created_at?: string | null
          date?: string | null
          duration?: number | null
          format?: string | null
          gender_mode?: string | null
          id?: string
          location?: string | null
          max_players?: number
          name?: string
          notes?: string | null
          prize_item_ids?: number[] | null
          raffle_published_at?: string | null
          ratings_applied_at?: string | null
          results_shared_at?: string | null
          status?: string | null
          tikkie_link?: string | null
          time?: string | null
          total_price?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      players_public: {
        Row: {
          adjusted_level: number | null
          adjustment: number | null
          avatar_url: string | null
          birthday_day: number | null
          birthday_md: string | null
          birthday_month: number | null
          country: string | null
          created_at: string | null
          gender: string | null
          id: string | null
          is_left_handed: boolean | null
          learned_matches_count: number | null
          learned_rating: number | null
          learned_rd: number | null
          learned_updated_at: string | null
          learned_volatility: number | null
          name: string | null
          pin_changes: number | null
          playtomic_level: number | null
          preferred_position: string | null
          role: Database['public']['Enums']['player_role'] | null
          status: string | null
          tagline: string | null
          tagline_label: string | null
        }
        Insert: {
          adjusted_level?: number | null
          adjustment?: number | null
          avatar_url?: string | null
          birthday_day?: never
          birthday_md?: never
          birthday_month?: never
          country?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string | null
          is_left_handed?: boolean | null
          learned_matches_count?: number | null
          learned_rating?: number | null
          learned_rd?: number | null
          learned_updated_at?: string | null
          learned_volatility?: number | null
          name?: string | null
          pin_changes?: never
          playtomic_level?: number | null
          preferred_position?: string | null
          role?: Database['public']['Enums']['player_role'] | null
          status?: string | null
          tagline?: string | null
          tagline_label?: string | null
        }
        Update: {
          adjusted_level?: number | null
          adjustment?: number | null
          avatar_url?: string | null
          birthday_day?: never
          birthday_md?: never
          birthday_month?: never
          country?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string | null
          is_left_handed?: boolean | null
          learned_matches_count?: number | null
          learned_rating?: number | null
          learned_rd?: number | null
          learned_updated_at?: string | null
          learned_volatility?: number | null
          name?: string | null
          pin_changes?: never
          playtomic_level?: number | null
          preferred_position?: string | null
          role?: Database['public']['Enums']['player_role'] | null
          status?: string | null
          tagline?: string | null
          tagline_label?: string | null
        }
        Relationships: []
      }
      public_tournament_registration_counts: {
        Row: {
          cancelled_count: number | null
          registered_count: number | null
          total_count: number | null
          tournament_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'registrations_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      _url_encode: { Args: { input: string }; Returns: string }
      admin_add_player: {
        Args: { input_payload: Json }
        Returns: {
          adjusted_level: number | null
          adjustment: number | null
          avatar_url: string | null
          birthday: string | null
          country: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          is_left_handed: boolean | null
          learned_matches_count: number
          learned_rating: number | null
          learned_rd: number | null
          learned_updated_at: string | null
          learned_volatility: number | null
          mm_rating: number | null
          mm_rating_updated_at: string | null
          mm_sigma: number | null
          name: string
          notes: string | null
          phone: string | null
          pin: string | null
          pin_changes: number
          pin_hash: string | null
          playtomic_level: number | null
          playtomic_updated_at: string | null
          playtomic_username: string | null
          preferred_position: string | null
          role: Database['public']['Enums']['player_role']
          status: string | null
          tagline: string | null
          tagline_label: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'players'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_apply_tournament_ratings: {
        Args: { input_payload: Json }
        Returns: number
      }
      admin_cancel_transfer: {
        Args: { input_transfer_id: string }
        Returns: {
          status: string
        }[]
      }
      admin_confirm_league_groups: {
        Args: { input_payload: Json }
        Returns: string
      }
      admin_create_bracket_matches: {
        Args: { input_league_id: string; input_payload: Json }
        Returns: string
      }
      admin_create_league: {
        Args: { input_payload: Json }
        Returns: {
          created_at: string | null
          created_by: string | null
          description_md: string | null
          description_sections: Json | null
          divisions: string[] | null
          ends_at: string | null
          finals_end: string | null
          finals_start: string | null
          group_stage_end: string | null
          group_stage_start: string | null
          id: string
          name: string
          quarters_end: string | null
          quarters_start: string | null
          semis_end: string | null
          semis_start: string | null
          signup_closes_at: string | null
          starts_at: string | null
          status: string
        }
        SetofOptions: {
          from: '*'
          to: 'leagues'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_league_team: {
        Args: { input_payload: Json }
        Returns: {
          created_at: string
          division: string
          experience_level: string
          group_label: string | null
          id: string
          league_id: string
          player1_id: string
          player2_id: string
          preferred_play_times: string | null
          spirit_animal: string | null
          team_name: string | null
          team_song: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'league_teams'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_league_team: {
        Args: { input_team_id: string }
        Returns: boolean
      }
      admin_delete_player: {
        Args: { input_target_id: string }
        Returns: boolean
      }
      admin_delete_raffle_winner: {
        Args: { input_winner_id: string }
        Returns: boolean
      }
      admin_draw_raffle_winners: {
        Args: {
          input_num_winners: number
          input_prizes?: string[]
          input_tournament_id: string
        }
        Returns: {
          cooldown_offset: number
          created_at: string
          id: string
          player_id: string
          prize: string | null
          tournament_id: string | null
          tournament_label: string | null
          won_at_date: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'raffle_winners'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_force_accept_transfer: {
        Args: { input_transfer_id: string }
        Returns: {
          status: string
        }[]
      }
      admin_get_mm_ratings: {
        Args: never
        Returns: {
          mm_rating: number
          mm_sigma: number
          player_id: string
        }[]
      }
      admin_get_player_pii: {
        Args: { input_target_id: string }
        Returns: {
          birthday: string
          email: string
          id: string
          notes: string
          phone: string
        }[]
      }
      admin_get_raffle_exclusions: {
        Args: { input_tournament_id: string }
        Returns: string[]
      }
      admin_get_raffle_ineligible: {
        Args: { input_tournament_id: string }
        Returns: {
          player_id: string
          reason: string
        }[]
      }
      admin_invite_league_player: {
        Args: { input_email: string; input_player_id: string }
        Returns: string
      }
      admin_list_security_events: {
        Args: { input_limit?: number }
        Returns: {
          attempt_kind: string
          attempted_at: string
          device_id: string
          id: number
          player_id: string
          player_name: string
          succeeded: boolean
          user_agent: string
        }[]
      }
      admin_persist_learned_ratings: {
        Args: { input_applied_tournament_ids?: string[]; input_updates: Json }
        Returns: number
      }
      admin_purge_player: {
        Args: { input_target_id: string }
        Returns: boolean
      }
      admin_record_league_match_result: {
        Args: { input_payload: Json }
        Returns: {
          created_at: string
          division: string
          id: string
          league_id: string
          location: string | null
          played_on: string | null
          set_scores: Json | null
          stage: string
          team1_id: string | null
          team2_id: string | null
          winner_id: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'league_matches'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_record_schedule_run: {
        Args: { input_payload: Json }
        Returns: string
      }
      admin_regenerate_pin: {
        Args: { input_target_id: string }
        Returns: string
      }
      admin_review_rating_event: {
        Args: {
          input_action: string
          input_delta?: number
          input_event_id: string
        }
        Returns: {
          applied_delta: number
          breakdown: Json
          created_at: string | null
          flagged: boolean
          id: string
          kind: string
          player_id: string
          prior_mu: number
          prior_sigma: number
          proposed_delta: number
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          tournament_id: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'rating_events'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_raffle_exclusions: {
        Args: { input_player_ids: string[]; input_tournament_id: string }
        Returns: undefined
      }
      admin_update_league_status: {
        Args: { input_league_id: string; input_status: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          description_md: string | null
          description_sections: Json | null
          divisions: string[] | null
          ends_at: string | null
          finals_end: string | null
          finals_start: string | null
          group_stage_end: string | null
          group_stage_start: string | null
          id: string
          name: string
          quarters_end: string | null
          quarters_start: string | null
          semis_end: string | null
          semis_start: string | null
          signup_closes_at: string | null
          starts_at: string | null
          status: string
        }
        SetofOptions: {
          from: '*'
          to: 'leagues'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_league_team: {
        Args: { input_payload: Json; input_team_id: string }
        Returns: {
          created_at: string
          division: string
          experience_level: string
          group_label: string | null
          id: string
          league_id: string
          player1_id: string
          player2_id: string
          preferred_play_times: string | null
          spirit_animal: string | null
          team_name: string | null
          team_song: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'league_teams'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_player: {
        Args: { input_payload: Json; input_target_id: string }
        Returns: boolean
      }
      admin_update_raffle_winner_prize: {
        Args: { input_prize: string; input_winner_id: string }
        Returns: boolean
      }
      apply_registration_transfer: {
        Args: { input_transfer_id: string }
        Returns: string
      }
      cancel_registration: {
        Args: { input_registration_id: string }
        Returns: {
          promoted_player_id: string
          promoted_registration_id: string
          status: string
        }[]
      }
      cancel_transfer: {
        Args: { input_transfer_id: string }
        Returns: {
          status: string
        }[]
      }
      create_transfer: {
        Args: { input_to_player_id: string; input_tournament_id: string }
        Returns: {
          status: string
          transfer_id: string
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_all_players_with_pii_v2: {
        Args: never
        Returns: {
          adjusted_level: number | null
          adjustment: number | null
          avatar_url: string | null
          birthday: string | null
          country: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          is_left_handed: boolean | null
          learned_matches_count: number
          learned_rating: number | null
          learned_rd: number | null
          learned_updated_at: string | null
          learned_volatility: number | null
          mm_rating: number | null
          mm_rating_updated_at: string | null
          mm_sigma: number | null
          name: string
          notes: string | null
          phone: string | null
          pin: string | null
          pin_changes: number
          pin_hash: string | null
          playtomic_level: number | null
          playtomic_updated_at: string | null
          playtomic_username: string | null
          preferred_position: string | null
          role: Database['public']['Enums']['player_role']
          status: string | null
          tagline: string | null
          tagline_label: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'players'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_profile_v2: {
        Args: never
        Returns: {
          adjusted_level: number | null
          adjustment: number | null
          avatar_url: string | null
          birthday: string | null
          country: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          is_left_handed: boolean | null
          learned_matches_count: number
          learned_rating: number | null
          learned_rd: number | null
          learned_updated_at: string | null
          learned_volatility: number | null
          mm_rating: number | null
          mm_rating_updated_at: string | null
          mm_sigma: number | null
          name: string
          notes: string | null
          phone: string | null
          pin: string | null
          pin_changes: number
          pin_hash: string | null
          playtomic_level: number | null
          playtomic_updated_at: string | null
          playtomic_username: string | null
          preferred_position: string | null
          role: Database['public']['Enums']['player_role']
          status: string | null
          tagline: string | null
          tagline_label: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'players'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_payment_reminder_link: {
        Args: { input_registration_id: string }
        Returns: string
      }
      get_transfer_recipient_phone: {
        Args: { input_transfer_id: string }
        Returns: {
          name: string
          phone: string
          status: string
        }[]
      }
      lobster_oscars_admin_end: {
        Args: { input_tournament_id: string }
        Returns: string
      }
      lobster_oscars_admin_get_category_voters: {
        Args: { input_category_id: string }
        Returns: {
          player_id: string
          player_name: string
          voted: boolean
        }[]
      }
      lobster_oscars_admin_get_results: {
        Args: { input_tournament_id: string }
        Returns: {
          category_icon: string
          category_id: string
          category_name: string
          display_order: number
          rank_in_category: number
          target_id: string
          target_name: string
          votes_count: number
        }[]
      }
      lobster_oscars_admin_get_session: {
        Args: { input_tournament_id: string }
        Returns: {
          closed_at: string
          created_at: string
          session_id: string
          shared_at: string
          started_at: string
          tournament_id: string
        }[]
      }
      lobster_oscars_admin_get_stats: {
        Args: { input_tournament_id: string }
        Returns: {
          category_icon: string
          category_id: string
          category_name: string
          display_order: number
          total_participants: number
          votes_count: number
        }[]
      }
      lobster_oscars_admin_share: {
        Args: { input_tournament_id: string }
        Returns: string
      }
      lobster_oscars_admin_start: {
        Args: { input_tournament_id: string }
        Returns: string
      }
      lobster_oscars_admin_upsert_categories: {
        Args: { input_categories: Json; input_tournament_id: string }
        Returns: string
      }
      lobster_oscars_cast_vote: {
        Args: { input_category_id: string; input_target_id: string }
        Returns: string
      }
      lobster_oscars_clear_vote: {
        Args: { input_category_id: string }
        Returns: string
      }
      lobster_oscars_get_my_votes: {
        Args: { input_tournament_id: string }
        Returns: {
          category_id: string
          target_id: string
          target_name: string
          updated_at: string
        }[]
      }
      lobster_oscars_get_results: {
        Args: { input_tournament_id: string }
        Returns: {
          category_icon: string
          category_id: string
          category_name: string
          display_order: number
          rank_in_category: number
          target_id: string
          target_name: string
          total_voters: number
          votes_count: number
        }[]
      }
      promote_waitlist_registration: {
        Args: { input_registration_id: string }
        Returns: {
          status: string
        }[]
      }
      record_mm_reset: {
        Args: {
          input_kind: string
          input_new_level: number
          input_player_id: string
          input_prior_mu: number
          input_prior_sigma: number
        }
        Returns: undefined
      }
      register_for_tournament: {
        Args: { input_player_id: string; input_tournament_id: string }
        Returns: {
          registration_id: string
          status: string
        }[]
      }
      require_admin: { Args: never; Returns: undefined }
      respond_to_transfer: {
        Args: { input_accept: boolean; input_transfer_id: string }
        Returns: {
          status: string
        }[]
      }
      self_signup_player: {
        Args: {
          input_device_id?: string
          input_payload: Json
          input_user_agent?: string
        }
        Returns: {
          pin: string
          player_id: string
          was_existing: boolean
        }[]
      }
      sync_my_role: { Args: never; Returns: Json }
      tournament_start_ts: {
        Args: { input_tournament_id: string }
        Returns: string
      }
      update_my_profile: { Args: { input_payload: Json }; Returns: boolean }
      verify_player_pin_v2: {
        Args: {
          input_device_id: string
          input_pin: string
          input_user_agent?: string
        }
        Returns: {
          player_id: string
          status: string
        }[]
      }
    }
    Enums: {
      player_role: 'player' | 'admin'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      player_role: ['player', 'admin'],
    },
  },
} as const

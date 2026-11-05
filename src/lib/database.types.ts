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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          id: number
          latest_version_code: number
          latest_version_name: string
          updated_at: string
        }
        Insert: {
          id?: number
          latest_version_code: number
          latest_version_name: string
          updated_at?: string
        }
        Update: {
          id?: number
          latest_version_code?: number
          latest_version_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_invites: {
        Row: {
          code: string
          created_at: string
          group_id: string
        }
        Insert: {
          code: string
          created_at?: string
          group_id: string
        }
        Update: {
          code?: string
          created_at?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          hidden_at: string | null
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          hidden_at?: string | null
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          hidden_at?: string | null
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          admin_id: string
          check_every_min: number
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          save_every_min: number
        }
        Insert: {
          admin_id: string
          check_every_min?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          save_every_min?: number
        }
        Update: {
          admin_id?: string
          check_every_min?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          save_every_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "groups_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      latest_locations: {
        Row: {
          accuracy_m: number | null
          battery_pct: number | null
          heading: number | null
          lat: number
          lng: number
          recorded_at: string
          source: Database["public"]["Enums"]["location_source"]
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          battery_pct?: number | null
          heading?: number | null
          lat: number
          lng: number
          recorded_at: string
          source: Database["public"]["Enums"]["location_source"]
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          battery_pct?: number | null
          heading?: number | null
          lat?: number
          lng?: number
          recorded_at?: string
          source?: Database["public"]["Enums"]["location_source"]
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "latest_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          accuracy_m: number | null
          battery_pct: number | null
          heading: number | null
          id: number
          lat: number
          lng: number
          received_at: string
          recorded_at: string
          source: Database["public"]["Enums"]["location_source"]
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          battery_pct?: number | null
          heading?: number | null
          id?: never
          lat: number
          lng: number
          received_at?: string
          recorded_at: string
          source?: Database["public"]["Enums"]["location_source"]
          speed?: number | null
          user_id?: string
        }
        Update: {
          accuracy_m?: number | null
          battery_pct?: number | null
          heading?: number | null
          id?: never
          lat?: number
          lng?: number
          received_at?: string
          recorded_at?: string
          source?: Database["public"]["Enums"]["location_source"]
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          last_seen_at: string | null
          paused_until: string | null
          sharing_enabled: boolean
          status: Database["public"]["Enums"]["device_status"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id: string
          last_seen_at?: string | null
          paused_until?: string | null
          sharing_enabled?: boolean
          status?: Database["public"]["Enums"]["device_status"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          last_seen_at?: string | null
          paused_until?: string | null
          sharing_enabled?: boolean
          status?: Database["public"]["Enums"]["device_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_group: {
        Args: { p_name: string }
        Returns: {
          group_id: string
          invite_code: string
        }[]
      }
      delete_group: { Args: { p_group_id: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      join_group: { Args: { p_code: string }; Returns: string }
      kick_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      leave_group: { Args: { p_group_id: string }; Returns: undefined }
      preview_group: {
        Args: { p_code: string }
        Returns: {
          group_id: string
          is_closing: boolean
          is_member: boolean
          member_count: number
          name: string
        }[]
      }
      regenerate_invite_code: { Args: { p_group_id: string }; Returns: string }
      rename_group: {
        Args: { p_group_id: string; p_name: string }
        Returns: undefined
      }
      restore_group: { Args: { p_group_id: string }; Returns: boolean }
      restore_my_account: { Args: never; Returns: boolean }
      set_group_timing: {
        Args: {
          p_check_every_min: number
          p_group_id: string
          p_save_every_min: number
        }
        Returns: undefined
      }
      set_hidden_from_group: {
        Args: { p_group_id: string; p_hidden: boolean }
        Returns: undefined
      }
      transfer_admin: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      device_status: "ok" | "location_off" | "permission_missing"
      location_source: "fused" | "last_known" | "ip"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      device_status: ["ok", "location_off", "permission_missing"],
      location_source: ["fused", "last_known", "ip"],
    },
  },
} as const

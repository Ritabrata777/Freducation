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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auto_flag_config: {
        Row: {
          banned_keywords: string[]
          id: boolean
          link_timeout_ms: number
          min_image_dim: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          banned_keywords?: string[]
          id?: boolean
          link_timeout_ms?: number
          min_image_dim?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          banned_keywords?: string[]
          id?: boolean
          link_timeout_ms?: number
          min_image_dim?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      collections: {
        Row: {
          board: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          language: string | null
          region: string | null
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          board?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          language?: string | null
          region?: string | null
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          board?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          language?: string | null
          region?: string | null
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      material_appeals: {
        Row: {
          admin_note: string | null
          created_at: string
          evidence: Json
          id: string
          material_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["appeal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          material_id: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["appeal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          evidence?: Json
          id?: string
          material_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["appeal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_appeals_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_comment_votes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "material_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      material_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["comment_kind"]
          material_id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["comment_kind"]
          material_id: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["comment_kind"]
          material_id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_comments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "material_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      material_progress: {
        Row: {
          created_at: string
          id: string
          material_id: string
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          status: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_progress_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_request_votes: {
        Row: {
          created_at: string
          id: string
          request_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_request_votes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          board: string | null
          created_at: string
          description: string | null
          fulfilled_at: string | null
          fulfilled_by: string | null
          fulfilled_material_id: string | null
          id: string
          region: string | null
          requester_id: string
          status: Database["public"]["Enums"]["request_status"]
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          board?: string | null
          created_at?: string
          description?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfilled_material_id?: string | null
          id?: string
          region?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["request_status"]
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          board?: string | null
          created_at?: string
          description?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfilled_material_id?: string | null
          id?: string
          region?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_fulfilled_material_id_fkey"
            columns: ["fulfilled_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_votes: {
        Row: {
          created_at: string
          id: string
          material_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_votes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          board: string | null
          collection_id: string | null
          content_hash: string | null
          created_at: string
          created_by: string
          description: string | null
          external_url: string | null
          file_url: string | null
          flag_reasons: string[]
          id: string
          language: string | null
          material_type: Database["public"]["Enums"]["material_type"]
          region: string | null
          status: Database["public"]["Enums"]["material_status"]
          subject: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          board?: string | null
          collection_id?: string | null
          content_hash?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          flag_reasons?: string[]
          id?: string
          language?: string | null
          material_type?: Database["public"]["Enums"]["material_type"]
          region?: string | null
          status?: Database["public"]["Enums"]["material_status"]
          subject?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          board?: string | null
          collection_id?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          flag_reasons?: string[]
          id?: string
          language?: string | null
          material_type?: Database["public"]["Enums"]["material_type"]
          region?: string | null
          status?: Database["public"]["Enums"]["material_status"]
          subject?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_log: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action"]
          actor_id: string
          actor_name: string | null
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          target_id: string | null
          target_label: string | null
          target_type: Database["public"]["Enums"]["moderation_target"]
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action"]
          actor_id: string
          actor_name?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type: Database["public"]["Enums"]["moderation_target"]
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action"]
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type?: Database["public"]["Enums"]["moderation_target"]
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: number
          path: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          path: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          path?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          board: string | null
          created_at: string
          display_name: string
          id: string
          language: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          board?: string | null
          created_at?: string
          display_name?: string
          id: string
          language?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          board?: string | null
          created_at?: string
          display_name?: string
          id?: string
          language?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          material_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymous_page_views: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_trusted_contributor: { Args: { _user_id: string }; Returns: boolean }
      total_page_views: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "contributor" | "learner"
      appeal_status: "pending" | "approved" | "rejected"
      comment_kind: "comment" | "question" | "answer"
      material_status: "pending" | "live" | "flagged" | "rejected"
      material_type: "pdf" | "link" | "notes" | "image" | "mcq" | "video"
      moderation_action:
        | "material_status_change"
        | "material_delete"
        | "user_delete"
        | "report_dismiss"
      moderation_target: "material" | "user" | "report"
      progress_status: "reading" | "completed" | "saved"
      request_status: "open" | "fulfilled" | "closed"
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
      app_role: ["admin", "moderator", "contributor", "learner"],
      appeal_status: ["pending", "approved", "rejected"],
      comment_kind: ["comment", "question", "answer"],
      material_status: ["pending", "live", "flagged", "rejected"],
      material_type: ["pdf", "link", "notes", "image", "mcq", "video"],
      moderation_action: [
        "material_status_change",
        "material_delete",
        "user_delete",
        "report_dismiss",
      ],
      moderation_target: ["material", "user", "report"],
      progress_status: ["reading", "completed", "saved"],
      request_status: ["open", "fulfilled", "closed"],
    },
  },
} as const

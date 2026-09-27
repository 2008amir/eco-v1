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
      active_days: {
        Row: {
          created_at: string
          day: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_likes: {
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
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          research_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          research_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          research_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          active_projects: number
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          invite_code: string
          is_general: boolean
          location: string | null
          members_can_post: boolean
          name: string
          updated_at: string
          visibility: string
        }
        Insert: {
          active_projects?: number
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          invite_code?: string
          is_general?: boolean
          location?: string | null
          members_can_post?: boolean
          name: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          active_projects?: number
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          invite_code?: string
          is_general?: boolean
          location?: string | null
          members_can_post?: boolean
          name?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      community_join_requests: {
        Row: {
          community_id: string
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          community_id: string
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          community_id?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_join_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_messages: {
        Row: {
          community_id: string
          content: string | null
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          sender_id: string
        }
        Insert: {
          community_id: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          community_id?: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_project_reviews: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          project_id: string
          title: string | null
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          id?: string
          project_id: string
          title?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_project_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "community_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      community_projects: {
        Row: {
          community_id: string
          created_at: string
          created_by: string
          description: string
          id: string
          image_url: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_projects_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          research_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          research_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          research_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_research_id_fkey"
            columns: ["research_id"]
            isOneToOne: false
            referencedRelation: "research"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      org_policies: {
        Row: {
          content: string
          created_at: string
          key: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          key: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          id: string
          note: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          id?: string
          note?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          note?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          period: string | null
          position_id: string | null
          receipt_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          period?: string | null
          position_id?: string | null
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          period?: string | null
          position_id?: string | null
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string
          description: string
          id: string
          is_member: boolean
          monthly_amount: number
          name: string
          reg_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_member?: boolean
          monthly_amount?: number
          name: string
          reg_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_member?: boolean
          monthly_amount?: number
          name?: string
          reg_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          address_line1: string | null
          address_line2: string | null
          address_line3: string | null
          avatar_url: string | null
          blood_group: string | null
          city: string | null
          country: string
          course_of_study: string | null
          created_at: string
          date_of_birth: string | null
          emergency_name: string | null
          emergency_phone: string | null
          emergency_relationship: string | null
          first_name: string
          gender: string | null
          graduation_year: string | null
          guardian_address: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_relationship: string | null
          home_email: string | null
          home_number: string | null
          id: string
          id_full_name: string | null
          id_phone: string | null
          institution: string | null
          is_graduate: boolean | null
          is_revoked: boolean
          last_name: string
          member_no: string | null
          middle_name: string | null
          onboarding_step: number
          pending_position_id: string | null
          phone: string | null
          policy_accepted_at: string | null
          position_id: string | null
          position_pending: boolean
          program_of_study: string | null
          registered_at: string | null
          school_level: string | null
          signature_data: string | null
          state: string | null
          updated_at: string
          username: string
        }
        Insert: {
          account_status?: string
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          avatar_url?: string | null
          blood_group?: string | null
          city?: string | null
          country?: string
          course_of_study?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          first_name?: string
          gender?: string | null
          graduation_year?: string | null
          guardian_address?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          home_email?: string | null
          home_number?: string | null
          id: string
          id_full_name?: string | null
          id_phone?: string | null
          institution?: string | null
          is_graduate?: boolean | null
          is_revoked?: boolean
          last_name?: string
          member_no?: string | null
          middle_name?: string | null
          onboarding_step?: number
          pending_position_id?: string | null
          phone?: string | null
          policy_accepted_at?: string | null
          position_id?: string | null
          position_pending?: boolean
          program_of_study?: string | null
          registered_at?: string | null
          school_level?: string | null
          signature_data?: string | null
          state?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          account_status?: string
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          avatar_url?: string | null
          blood_group?: string | null
          city?: string | null
          country?: string
          course_of_study?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          emergency_relationship?: string | null
          first_name?: string
          gender?: string | null
          graduation_year?: string | null
          guardian_address?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_relationship?: string | null
          home_email?: string | null
          home_number?: string | null
          id?: string
          id_full_name?: string | null
          id_phone?: string | null
          institution?: string | null
          is_graduate?: boolean | null
          is_revoked?: boolean
          last_name?: string
          member_no?: string | null
          middle_name?: string | null
          onboarding_step?: number
          pending_position_id?: string | null
          phone?: string | null
          policy_accepted_at?: string | null
          position_id?: string | null
          position_pending?: boolean
          program_of_study?: string | null
          registered_at?: string | null
          school_level?: string | null
          signature_data?: string | null
          state?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pending_position_id_fkey"
            columns: ["pending_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      research: {
        Row: {
          author_id: string | null
          category: string
          content_html: string
          created_at: string
          description: string
          header_image_url: string | null
          id: string
          post_kind: string
          research_number: string
          research_type: string
          section: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category?: string
          content_html?: string
          created_at?: string
          description?: string
          header_image_url?: string | null
          id?: string
          post_kind?: string
          research_number?: string
          research_type?: string
          section?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: string
          content_html?: string
          created_at?: string
          description?: string
          header_image_url?: string | null
          id?: string
          post_kind?: string
          research_number?: string
          research_type?: string
          section?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_research: {
        Row: {
          created_at: string
          id: string
          research_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          research_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          research_id?: string
          user_id?: string
        }
        Relationships: []
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
      admin_pending_payments: { Args: { _kind: string }; Returns: Json }
      admin_review_payment: {
        Args: { _action: string; _payment_id: string }
        Returns: undefined
      }
      admin_set_position: {
        Args: { _position_id: string; _user_id: string }
        Returns: undefined
      }
      admin_set_revoked: {
        Args: { _revoked: boolean; _user_id: string }
        Returns: undefined
      }
      generate_member_no: { Args: never; Returns: string }
      get_active_history: { Args: { period: string }; Returns: Json }
      get_admin_ids: { Args: never; Returns: string[] }
      get_admin_stats: { Args: never; Returns: Json }
      get_any_admin_id: { Args: never; Returns: string }
      get_email_for_username: { Args: { _username: string }; Returns: string }
      get_my_auth_state: {
        Args: never
        Returns: {
          is_admin: boolean
          profile: Json
        }[]
      }
      get_user_detail: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_community_admin: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      is_community_member: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      is_community_owner: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      is_username_available: { Args: { _username: string }; Returns: boolean }
      join_general_community: { Args: { _user_id: string }; Returns: undefined }
      public_member_card: { Args: { _member_no: string }; Returns: Json }
      record_my_activity: { Args: never; Returns: undefined }
      set_community_general: {
        Args: { _community_id: string; _general: boolean }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

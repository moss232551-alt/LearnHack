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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          reason: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      checkins: {
        Row: {
          created_at: string
          day: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          created_at: string
          decision: string
          id: string
          policy_version: string
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          policy_version: string
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          policy_version?: string
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_events: {
        Row: {
          classification: string
          created_at: string
          expires_at: string
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          classification: string
          created_at?: string
          expires_at?: string
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          classification?: string
          created_at?: string
          expires_at?: string
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_answers: {
        Row: {
          answer: string
          correct: boolean
          created_at: string
          game_id: string
          id: string
          points: number
          question_index: number
          user_id: string
        }
        Insert: {
          answer: string
          correct?: boolean
          created_at?: string
          game_id: string
          id?: string
          points?: number
          question_index: number
          user_id: string
        }
        Update: {
          answer?: string
          correct?: boolean
          created_at?: string
          game_id?: string
          id?: string
          points?: number
          question_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_answers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          created_at: string
          current_index: number
          host_id: string
          id: string
          question_started_at: string
          quiz_id: string
          room_id: string
          status: string
        }
        Insert: {
          created_at?: string
          current_index?: number
          host_id: string
          id?: string
          question_started_at?: string
          quiz_id: string
          room_id: string
          status?: string
        }
        Update: {
          created_at?: string
          current_index?: number
          host_id?: string
          id?: string
          question_started_at?: string
          quiz_id?: string
          room_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      host_reviews: {
        Row: {
          comment: string | null
          created_at: string
          host_id: string
          id: string
          rating: number
          reviewer_id: string
          room_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          host_id: string
          id?: string
          rating: number
          reviewer_id: string
          room_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          host_id?: string
          id?: string
          rating?: number
          reviewer_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_reviews_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          ai_feedback: Json | null
          author_id: string
          created_at: string
          detail_level: string
          id: string
          source_text: string | null
          status: string
          subject_id: string | null
          summary: string | null
          title: string
          uses_count: number
          visibility: string
        }
        Insert: {
          ai_feedback?: Json | null
          author_id: string
          created_at?: string
          detail_level?: string
          id?: string
          source_text?: string | null
          status?: string
          subject_id?: string | null
          summary?: string | null
          title: string
          uses_count?: number
          visibility?: string
        }
        Update: {
          ai_feedback?: Json | null
          author_id?: string
          created_at?: string
          detail_level?: string
          id?: string
          source_text?: string | null
          status?: string
          subject_id?: string | null
          summary?: string | null
          title?: string
          uses_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          focus_minutes: number
          id: string
          is_minor: boolean
          language: string
          last_checkin: string | null
          monitoring_opt_out: boolean
          pet_stage: number
          points: number
          streak_count: number
          suspended: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string
          focus_minutes?: number
          id: string
          is_minor?: boolean
          language?: string
          last_checkin?: string | null
          monitoring_opt_out?: boolean
          pet_stage?: number
          points?: number
          streak_count?: number
          suspended?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string
          focus_minutes?: number
          id?: string
          is_minor?: boolean
          language?: string
          last_checkin?: string | null
          monitoring_opt_out?: boolean
          pet_stage?: number
          points?: number
          streak_count?: number
          suspended?: boolean
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          score: number
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          score?: number
          total?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          answer: string
          explanation: string | null
          id: string
          options: Json
          position: number
          prompt: string
          qtype: string
          quiz_id: string
        }
        Insert: {
          answer: string
          explanation?: string | null
          id?: string
          options?: Json
          position?: number
          prompt: string
          qtype?: string
          quiz_id: string
        }
        Update: {
          answer?: string
          explanation?: string | null
          id?: string
          options?: Json
          position?: number
          prompt?: string
          qtype?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          ai_confidence: number | null
          ai_feedback: Json | null
          author_id: string
          created_at: string
          difficulty: string
          id: string
          lesson_id: string | null
          status: string
          subject_id: string | null
          title: string
          uses_count: number
          visibility: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_feedback?: Json | null
          author_id: string
          created_at?: string
          difficulty?: string
          id?: string
          lesson_id?: string | null
          status?: string
          subject_id?: string | null
          title: string
          uses_count?: number
          visibility?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_feedback?: Json | null
          author_id?: string
          created_at?: string
          difficulty?: string
          id?: string
          lesson_id?: string | null
          status?: string
          subject_id?: string | null
          title?: string
          uses_count?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      room_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          room_id: string
          storage_path: string | null
          summary: string | null
          uploader_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          room_id: string
          storage_path?: string | null
          summary?: string | null
          uploader_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          room_id?: string
          storage_path?: string | null
          summary?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_files_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      study_rooms: {
        Row: {
          active: boolean
          created_at: string
          id: string
          join_code: string
          mode: string
          monitored: boolean
          name: string
          owner_id: string
          subject_id: string | null
          topic: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          join_code?: string
          mode?: string
          monitored?: boolean
          name: string
          owner_id: string
          subject_id?: string | null
          topic?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          join_code?: string
          mode?: string
          monitored?: boolean
          name?: string
          owner_id?: string
          subject_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_rooms_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          distraction_count: number
          ended_at: string | null
          focus_minutes: number
          id: string
          monitored: boolean
          room_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          distraction_count?: number
          ended_at?: string | null
          focus_minutes?: number
          id?: string
          monitored?: boolean
          room_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          distraction_count?: number
          ended_at?: string | null
          focus_minutes?: number
          id?: string
          monitored?: boolean
          room_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          active: boolean
          agent_prompt: string
          code: string
          created_at: string
          id: string
          name_en: string
          name_th: string
        }
        Insert: {
          active?: boolean
          agent_prompt?: string
          code: string
          created_at?: string
          id?: string
          name_en: string
          name_th: string
        }
        Update: {
          active?: boolean
          agent_prompt?: string
          code?: string
          created_at?: string
          id?: string
          name_en?: string
          name_th?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

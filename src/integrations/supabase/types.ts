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
      cleaners: {
        Row: {
          active: string | null
          cleaner_id: string
          dbs_date: string | null
          dbs_done: string | null
          email: string | null
          employment_type: string | null
          id_document_type: string | null
          name: string | null
          notes: string | null
          pat_test_personal_kit: string | null
          phone: string | null
          pk: string
          region_primary: string | null
          right_to_work_expiry: string | null
          right_to_work_on_file: string | null
          safeguarding_done: string | null
          starter_checklist_completed: string | null
          sub_nlw_flag: string | null
          team_id: string | null
          version_id: string
        }
        Insert: {
          active?: string | null
          cleaner_id: string
          dbs_date?: string | null
          dbs_done?: string | null
          email?: string | null
          employment_type?: string | null
          id_document_type?: string | null
          name?: string | null
          notes?: string | null
          pat_test_personal_kit?: string | null
          phone?: string | null
          pk?: string
          region_primary?: string | null
          right_to_work_expiry?: string | null
          right_to_work_on_file?: string | null
          safeguarding_done?: string | null
          starter_checklist_completed?: string | null
          sub_nlw_flag?: string | null
          team_id?: string | null
          version_id: string
        }
        Update: {
          active?: string | null
          cleaner_id?: string
          dbs_date?: string | null
          dbs_done?: string | null
          email?: string | null
          employment_type?: string | null
          id_document_type?: string | null
          name?: string | null
          notes?: string | null
          pat_test_personal_kit?: string | null
          phone?: string | null
          pk?: string
          region_primary?: string | null
          right_to_work_expiry?: string | null
          right_to_work_on_file?: string | null
          safeguarding_done?: string | null
          starter_checklist_completed?: string | null
          sub_nlw_flag?: string | null
          team_id?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaners_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "data_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaners_overrides: {
        Row: {
          cleaner_id: string
          edited_at: string
          edited_by: string | null
          id: string
          is_active: boolean
          note: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload: Json | null
          reverted_at: string | null
          reverted_by: string | null
          version_id: string
        }
        Insert: {
          cleaner_id: string
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          version_id: string
        }
        Update: {
          cleaner_id?: string
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op?: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          version_id?: string
        }
        Relationships: []
      }
      closures: {
        Row: {
          affects: string | null
          closure_id: string
          date: string | null
          description: string | null
          pk: string
          type: string | null
          version_id: string
        }
        Insert: {
          affects?: string | null
          closure_id: string
          date?: string | null
          description?: string | null
          pk?: string
          type?: string | null
          version_id: string
        }
        Update: {
          affects?: string | null
          closure_id?: string
          date?: string | null
          description?: string | null
          pk?: string
          type?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closures_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "data_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      closures_overrides: {
        Row: {
          closure_id: string
          edited_at: string
          edited_by: string | null
          id: string
          is_active: boolean
          note: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload: Json | null
          reverted_at: string | null
          reverted_by: string | null
          version_id: string
        }
        Insert: {
          closure_id: string
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          version_id: string
        }
        Update: {
          closure_id?: string
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op?: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          version_id?: string
        }
        Relationships: []
      }
      commission_entries: {
        Row: {
          calculated_amount: number
          clawback_reason: string | null
          clawed_back_at: string | null
          clawed_back_by: string | null
          client_or_job: string
          contract_hours: number | null
          created_at: string
          hours: number | null
          hours_paid_confirmed: boolean | null
          id: string
          is_new_contract: boolean | null
          notes: string | null
          override_amount: number | null
          override_reason: string | null
          paid_at: string | null
          period_month: string
          profit_amount: number | null
          profit_tier: string | null
          rejected_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sent_to_accounts_at: string | null
          staff_name: string | null
          staff_user_id: string
          status: Database["public"]["Enums"]["commission_status"]
          type: Database["public"]["Enums"]["commission_type"]
          updated_at: string
        }
        Insert: {
          calculated_amount?: number
          clawback_reason?: string | null
          clawed_back_at?: string | null
          clawed_back_by?: string | null
          client_or_job: string
          contract_hours?: number | null
          created_at?: string
          hours?: number | null
          hours_paid_confirmed?: boolean | null
          id?: string
          is_new_contract?: boolean | null
          notes?: string | null
          override_amount?: number | null
          override_reason?: string | null
          paid_at?: string | null
          period_month: string
          profit_amount?: number | null
          profit_tier?: string | null
          rejected_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_to_accounts_at?: string | null
          staff_name?: string | null
          staff_user_id: string
          status?: Database["public"]["Enums"]["commission_status"]
          type: Database["public"]["Enums"]["commission_type"]
          updated_at?: string
        }
        Update: {
          calculated_amount?: number
          clawback_reason?: string | null
          clawed_back_at?: string | null
          clawed_back_by?: string | null
          client_or_job?: string
          contract_hours?: number | null
          created_at?: string
          hours?: number | null
          hours_paid_confirmed?: boolean | null
          id?: string
          is_new_contract?: boolean | null
          notes?: string | null
          override_amount?: number | null
          override_reason?: string | null
          paid_at?: string | null
          period_month?: string
          profit_amount?: number | null
          profit_tier?: string | null
          rejected_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_to_accounts_at?: string | null
          staff_name?: string | null
          staff_user_id?: string
          status?: Database["public"]["Enums"]["commission_status"]
          type?: Database["public"]["Enums"]["commission_type"]
          updated_at?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          bonus_tiers: Json
          id: string
          notes: string | null
          profit_max_payout: number
          profit_min_payout: number
          profit_rate_created: number
          profit_rate_identified: number
          recurring_tiers: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bonus_tiers?: Json
          id?: string
          notes?: string | null
          profit_max_payout?: number
          profit_min_payout?: number
          profit_rate_created?: number
          profit_rate_identified?: number
          recurring_tiers?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bonus_tiers?: Json
          id?: string
          notes?: string | null
          profit_max_payout?: number
          profit_min_payout?: number
          profit_rate_created?: number
          profit_rate_identified?: number
          recurring_tiers?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      data_versions: {
        Row: {
          activated_at: string | null
          id: string
          is_active: boolean
          label: string
          notes: string | null
          row_counts: Json | null
          source_filename: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          activated_at?: string | null
          id?: string
          is_active?: boolean
          label: string
          notes?: string | null
          row_counts?: Json | null
          source_filename?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          activated_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          notes?: string | null
          row_counts?: Json | null
          source_filename?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      delivery_log: {
        Row: {
          cleaner_id: string
          date: string | null
          delivery_id: string
          hours_clocked: number | null
          notes: string | null
          pay_rate_at_time: number | null
          pk: string
          site_id: string
          source: string | null
          version_id: string
        }
        Insert: {
          cleaner_id: string
          date?: string | null
          delivery_id: string
          hours_clocked?: number | null
          notes?: string | null
          pay_rate_at_time?: number | null
          pk?: string
          site_id: string
          source?: string | null
          version_id: string
        }
        Update: {
          cleaner_id?: string
          date?: string | null
          delivery_id?: string
          hours_clocked?: number | null
          notes?: string | null
          pay_rate_at_time?: number | null
          pk?: string
          site_id?: string
          source?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_log_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "data_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_overrides: {
        Row: {
          delivery_id: string
          edited_at: string
          edited_by: string | null
          id: string
          is_active: boolean
          note: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload: Json | null
          reverted_at: string | null
          reverted_by: string | null
          version_id: string
        }
        Insert: {
          delivery_id: string
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          version_id: string
        }
        Update: {
          delivery_id?: string
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op?: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          version_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule: {
        Row: {
          billing_rate_override: number | null
          cleaner_id: string
          confidence: string | null
          day_of_week: string | null
          duration_hours: number | null
          effective_from: string | null
          effective_to: string | null
          notes: string | null
          pay_rate: number | null
          pk: string
          schedule_id: string
          shift_group_id: string | null
          shift_role: string | null
          site_id: string
          start_time: string | null
          version_id: string
          visits_in_apr_2026: number | null
        }
        Insert: {
          billing_rate_override?: number | null
          cleaner_id: string
          confidence?: string | null
          day_of_week?: string | null
          duration_hours?: number | null
          effective_from?: string | null
          effective_to?: string | null
          notes?: string | null
          pay_rate?: number | null
          pk?: string
          schedule_id: string
          shift_group_id?: string | null
          shift_role?: string | null
          site_id: string
          start_time?: string | null
          version_id: string
          visits_in_apr_2026?: number | null
        }
        Update: {
          billing_rate_override?: number | null
          cleaner_id?: string
          confidence?: string | null
          day_of_week?: string | null
          duration_hours?: number | null
          effective_from?: string | null
          effective_to?: string | null
          notes?: string | null
          pay_rate?: number | null
          pk?: string
          schedule_id?: string
          shift_group_id?: string | null
          shift_role?: string | null
          site_id?: string
          start_time?: string | null
          version_id?: string
          visits_in_apr_2026?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "data_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_overrides: {
        Row: {
          edited_at: string
          edited_by: string | null
          id: string
          is_active: boolean
          note: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload: Json | null
          reverted_at: string | null
          reverted_by: string | null
          schedule_id: string
          version_id: string
        }
        Insert: {
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          schedule_id: string
          version_id: string
        }
        Update: {
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op?: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          schedule_id?: string
          version_id?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          access_instructions: string | null
          access_method: string | null
          active: string | null
          address: string | null
          alarm_info: string | null
          billing_rate_default: number | null
          client_name: string | null
          contract_end: string | null
          contract_start: string | null
          contract_type: string | null
          cupboard_codes: string | null
          general_notes: string | null
          hs_folder_last_updated: string | null
          pat_test_due: string | null
          pk: string
          postcode: string | null
          products_notes: string | null
          products_supplied_by: string | null
          region: string | null
          site_contact_email: string | null
          site_contact_name: string | null
          site_contact_phone: string | null
          site_id: string
          team_grouping: string | null
          term_time_only: string | null
          version_id: string
        }
        Insert: {
          access_instructions?: string | null
          access_method?: string | null
          active?: string | null
          address?: string | null
          alarm_info?: string | null
          billing_rate_default?: number | null
          client_name?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: string | null
          cupboard_codes?: string | null
          general_notes?: string | null
          hs_folder_last_updated?: string | null
          pat_test_due?: string | null
          pk?: string
          postcode?: string | null
          products_notes?: string | null
          products_supplied_by?: string | null
          region?: string | null
          site_contact_email?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_id: string
          team_grouping?: string | null
          term_time_only?: string | null
          version_id: string
        }
        Update: {
          access_instructions?: string | null
          access_method?: string | null
          active?: string | null
          address?: string | null
          alarm_info?: string | null
          billing_rate_default?: number | null
          client_name?: string | null
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: string | null
          cupboard_codes?: string | null
          general_notes?: string | null
          hs_folder_last_updated?: string | null
          pat_test_due?: string | null
          pk?: string
          postcode?: string | null
          products_notes?: string | null
          products_supplied_by?: string | null
          region?: string | null
          site_contact_email?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_id?: string
          team_grouping?: string | null
          term_time_only?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "data_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      sites_overrides: {
        Row: {
          edited_at: string
          edited_by: string | null
          id: string
          is_active: boolean
          note: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload: Json | null
          reverted_at: string | null
          reverted_by: string | null
          site_id: string
          version_id: string
        }
        Insert: {
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          site_id: string
          version_id: string
        }
        Update: {
          edited_at?: string
          edited_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          op?: Database["public"]["Enums"]["override_op"]
          payload?: Json | null
          reverted_at?: string | null
          reverted_by?: string | null
          site_id?: string
          version_id?: string
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
      cleaners_live: {
        Row: {
          active: string | null
          cleaner_id: string | null
          dbs_date: string | null
          dbs_done: string | null
          edited_at: string | null
          edited_by: string | null
          email: string | null
          employment_type: string | null
          is_overridden: boolean | null
          name: string | null
          notes: string | null
          override_id: string | null
          pat_test_personal_kit: string | null
          phone: string | null
          pk: string | null
          region_primary: string | null
          right_to_work_on_file: string | null
          safeguarding_done: string | null
          sub_nlw_flag: string | null
          team_id: string | null
          version_id: string | null
        }
        Relationships: []
      }
      closures_live: {
        Row: {
          affects: string | null
          closure_id: string | null
          date: string | null
          description: string | null
          edited_at: string | null
          edited_by: string | null
          is_overridden: boolean | null
          override_id: string | null
          pk: string | null
          type: string | null
          version_id: string | null
        }
        Relationships: []
      }
      delivery_live: {
        Row: {
          cleaner_id: string | null
          date: string | null
          delivery_id: string | null
          edited_at: string | null
          edited_by: string | null
          hours_clocked: number | null
          is_overridden: boolean | null
          notes: string | null
          override_id: string | null
          pay_rate_at_time: number | null
          pk: string | null
          site_id: string | null
          source: string | null
          version_id: string | null
        }
        Relationships: []
      }
      schedule_live: {
        Row: {
          billing_rate_override: number | null
          cleaner_id: string | null
          confidence: string | null
          day_of_week: string | null
          duration_hours: number | null
          edited_at: string | null
          edited_by: string | null
          effective_from: string | null
          effective_to: string | null
          is_overridden: boolean | null
          notes: string | null
          override_id: string | null
          pay_rate: number | null
          pk: string | null
          schedule_id: string | null
          shift_group_id: string | null
          shift_role: string | null
          site_id: string | null
          start_time: string | null
          version_id: string | null
          visits_in_apr_2026: number | null
        }
        Relationships: []
      }
      sites_live: {
        Row: {
          access_instructions: string | null
          access_method: string | null
          active: string | null
          address: string | null
          alarm_info: string | null
          billing_rate_default: number | null
          client_name: string | null
          contract_end: string | null
          contract_start: string | null
          contract_type: string | null
          cupboard_codes: string | null
          edited_at: string | null
          edited_by: string | null
          general_notes: string | null
          hs_folder_last_updated: string | null
          is_overridden: boolean | null
          override_id: string | null
          pat_test_due: string | null
          pk: string | null
          postcode: string | null
          products_notes: string | null
          products_supplied_by: string | null
          region: string | null
          site_contact_email: string | null
          site_contact_name: string | null
          site_contact_phone: string | null
          site_id: string | null
          team_grouping: string | null
          term_time_only: string | null
          version_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      active_version_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "owner"
      commission_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "sent_to_accounts"
        | "paid"
        | "clawed_back"
      commission_type: "recurring" | "bonus" | "profit"
      override_op: "upsert" | "delete"
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
      app_role: ["admin", "staff", "owner"],
      commission_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "sent_to_accounts",
        "paid",
        "clawed_back",
      ],
      commission_type: ["recurring", "bonus", "profit"],
      override_op: ["upsert", "delete"],
    },
  },
} as const

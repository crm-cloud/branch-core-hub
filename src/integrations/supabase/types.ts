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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_devices: {
        Row: {
          branch_id: string
          config: Json | null
          created_at: string | null
          device_name: string
          device_type: string
          firmware_version: string | null
          id: string
          ip_address: unknown
          is_online: boolean | null
          last_heartbeat: string | null
          last_sync: string | null
          mac_address: string | null
          mips_device_id: number | null
          model: string | null
          public_ip: string | null
          relay_delay: number | null
          relay_mode: number | null
          serial_number: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          config?: Json | null
          created_at?: string | null
          device_name: string
          device_type?: string
          firmware_version?: string | null
          id?: string
          ip_address: unknown
          is_online?: boolean | null
          last_heartbeat?: string | null
          last_sync?: string | null
          mac_address?: string | null
          mips_device_id?: number | null
          model?: string | null
          public_ip?: string | null
          relay_delay?: number | null
          relay_mode?: number | null
          serial_number?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          config?: Json | null
          created_at?: string | null
          device_name?: string
          device_type?: string
          firmware_version?: string | null
          id?: string
          ip_address?: unknown
          is_online?: boolean | null
          last_heartbeat?: string | null
          last_sync?: string | null
          mac_address?: string | null
          mips_device_id?: number | null
          model?: string | null
          public_ip?: string | null
          relay_delay?: number | null
          relay_mode?: number | null
          serial_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      access_logs: {
        Row: {
          branch_id: string | null
          captured_at: string | null
          created_at: string
          device_sn: string
          event_type: string
          hardware_device_id: string | null
          id: string
          member_id: string | null
          message: string | null
          payload: Json | null
          profile_id: string | null
          result: string | null
        }
        Insert: {
          branch_id?: string | null
          captured_at?: string | null
          created_at?: string
          device_sn: string
          event_type: string
          hardware_device_id?: string | null
          id?: string
          member_id?: string | null
          message?: string | null
          payload?: Json | null
          profile_id?: string | null
          result?: string | null
        }
        Update: {
          branch_id?: string | null
          captured_at?: string | null
          created_at?: string
          device_sn?: string
          event_type?: string
          hardware_device_id?: string | null
          id?: string
          member_id?: string | null
          message?: string | null
          payload?: Json | null
          profile_id?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_hardware_device_id_fkey"
            columns: ["hardware_device_id"]
            isOneToOne: false
            referencedRelation: "hardware_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_banners: {
        Row: {
          branch_id: string
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          redirect_url: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          redirect_url?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          redirect_url?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_banners_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_plan_logs: {
        Row: {
          created_at: string
          id: string
          member_id: string
          plan_id: string | null
          plan_type: string
          prompt: string | null
          response: Json | null
          tokens_used: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          plan_id?: string | null
          plan_type: string
          prompt?: string | null
          response?: Json | null
          tokens_used?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          plan_id?: string | null
          plan_type?: string
          prompt?: string | null
          response?: Json | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_plan_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_logs: {
        Row: {
          arguments: Json | null
          branch_id: string | null
          chat_id: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          message_id: string | null
          phone_number: string | null
          result: Json | null
          status: string
          tool_name: string
        }
        Insert: {
          arguments?: Json | null
          branch_id?: string | null
          chat_id?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          message_id?: string | null
          phone_number?: string | null
          result?: Json | null
          status?: string
          tool_name: string
        }
        Update: {
          arguments?: Json | null
          branch_id?: string | null
          chat_id?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          message_id?: string | null
          phone_number?: string | null
          result?: Json | null
          status?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          branch_id: string | null
          content: string
          created_at: string
          created_by: string | null
          expire_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          publish_at: string | null
          target_audience: string | null
          title: string
        }
        Insert: {
          branch_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          expire_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          publish_at?: string | null
          target_audience?: string | null
          title: string
        }
        Update: {
          branch_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          expire_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          publish_at?: string | null
          target_audience?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          branch_id: string
          created_at: string
          id: string
          reference_id: string
          reference_type: string
          request_data: Json
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approval_type: Database["public"]["Enums"]["approval_type"]
          branch_id: string
          created_at?: string
          id?: string
          reference_id: string
          reference_type: string
          request_data: Json
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approval_type?: Database["public"]["Enums"]["approval_type"]
          branch_id?: string
          created_at?: string
          id?: string
          reference_id?: string
          reference_type?: string
          request_data?: Json
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          action_description: string | null
          actor_name: string | null
          branch_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          action_description?: string | null
          actor_name?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          action_description?: string | null
          actor_name?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      benefit_bookings: {
        Row: {
          booked_at: string
          cancellation_reason: string | null
          cancelled_at: string | null
          check_in_at: string | null
          created_at: string
          id: string
          member_id: string
          membership_id: string
          no_show_marked_at: string | null
          notes: string | null
          slot_id: string
          status: Database["public"]["Enums"]["benefit_booking_status"]
          updated_at: string
        }
        Insert: {
          booked_at?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          check_in_at?: string | null
          created_at?: string
          id?: string
          member_id: string
          membership_id: string
          no_show_marked_at?: string | null
          notes?: string | null
          slot_id: string
          status?: Database["public"]["Enums"]["benefit_booking_status"]
          updated_at?: string
        }
        Update: {
          booked_at?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          check_in_at?: string | null
          created_at?: string
          id?: string
          member_id?: string
          membership_id?: string
          no_show_marked_at?: string | null
          notes?: string | null
          slot_id?: string
          status?: Database["public"]["Enums"]["benefit_booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_bookings_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "benefit_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_packages: {
        Row: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id: string | null
          branch_id: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          quantity: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          branch_id: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          quantity: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          branch_id?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          quantity?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "benefit_packages_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_packages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_settings: {
        Row: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id: string | null
          booking_opens_hours_before: number | null
          branch_id: string
          buffer_between_sessions_minutes: number | null
          cancellation_deadline_minutes: number | null
          capacity_per_slot: number | null
          created_at: string
          id: string
          is_slot_booking_enabled: boolean | null
          max_bookings_per_day: number | null
          no_show_penalty_amount: number | null
          no_show_policy: Database["public"]["Enums"]["no_show_policy"] | null
          operating_hours_end: string | null
          operating_hours_start: string | null
          slot_duration_minutes: number | null
          updated_at: string
        }
        Insert: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          booking_opens_hours_before?: number | null
          branch_id: string
          buffer_between_sessions_minutes?: number | null
          cancellation_deadline_minutes?: number | null
          capacity_per_slot?: number | null
          created_at?: string
          id?: string
          is_slot_booking_enabled?: boolean | null
          max_bookings_per_day?: number | null
          no_show_penalty_amount?: number | null
          no_show_policy?: Database["public"]["Enums"]["no_show_policy"] | null
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          slot_duration_minutes?: number | null
          updated_at?: string
        }
        Update: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          booking_opens_hours_before?: number | null
          branch_id?: string
          buffer_between_sessions_minutes?: number | null
          cancellation_deadline_minutes?: number | null
          capacity_per_slot?: number | null
          created_at?: string
          id?: string
          is_slot_booking_enabled?: boolean | null
          max_bookings_per_day?: number | null
          no_show_penalty_amount?: number | null
          no_show_policy?: Database["public"]["Enums"]["no_show_policy"] | null
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          slot_duration_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_settings_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_slots: {
        Row: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id: string | null
          booked_count: number | null
          branch_id: string
          capacity: number
          created_at: string
          end_time: string
          facility_id: string | null
          id: string
          is_active: boolean | null
          slot_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          booked_count?: number | null
          branch_id: string
          capacity?: number
          created_at?: string
          end_time: string
          facility_id?: string | null
          id?: string
          is_active?: boolean | null
          slot_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          booked_count?: number | null
          branch_id?: string
          capacity?: number
          created_at?: string
          end_time?: string
          facility_id?: string | null
          id?: string
          is_active?: boolean | null
          slot_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_slots_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_slots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_slots_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_types: {
        Row: {
          branch_id: string
          category: string | null
          code: string
          created_at: string
          default_duration_minutes: number | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_bookable: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          category?: string | null
          code: string
          created_at?: string
          default_duration_minutes?: number | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_bookable?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          category?: string | null
          code?: string
          created_at?: string
          default_duration_minutes?: number | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_bookable?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_types_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      benefit_usage: {
        Row: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id: string | null
          created_at: string
          id: string
          membership_id: string
          notes: string | null
          recorded_by: string | null
          usage_count: number | null
          usage_date: string
        }
        Insert: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          created_at?: string
          id?: string
          membership_id: string
          notes?: string | null
          recorded_by?: string | null
          usage_count?: number | null
          usage_date?: string
        }
        Update: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          created_at?: string
          id?: string
          membership_id?: string
          notes?: string | null
          recorded_by?: string | null
          usage_count?: number | null
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_usage_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_usage_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_usage_recorded_by_profiles_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      biometric_sync_queue: {
        Row: {
          device_id: string | null
          error_message: string | null
          id: string
          member_id: string | null
          person_name: string
          person_uuid: string
          photo_url: string
          processed_at: string | null
          queued_at: string | null
          retry_count: number | null
          staff_id: string | null
          status: string | null
          sync_type: string
        }
        Insert: {
          device_id?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          person_name: string
          person_uuid: string
          photo_url: string
          processed_at?: string | null
          queued_at?: string | null
          retry_count?: number | null
          staff_id?: string | null
          status?: string | null
          sync_type: string
        }
        Update: {
          device_id?: string | null
          error_message?: string | null
          id?: string
          member_id?: string | null
          person_name?: string
          person_uuid?: string
          photo_url?: string
          processed_at?: string | null
          queued_at?: string | null
          retry_count?: number | null
          staff_id?: string | null
          status?: string | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "biometric_sync_queue_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_sync_queue_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_sync_queue_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_managers: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_managers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_managers_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_settings: {
        Row: {
          advance_booking_days: number | null
          auto_attendance_checkout: boolean | null
          block_access_on_overdue: boolean
          branch_id: string
          cancellation_fee_rate: number | null
          checkout_after_hours: number | null
          created_at: string
          currency: string | null
          freeze_fee: number | null
          freeze_max_days: number | null
          freeze_min_days: number | null
          id: string
          late_fee_rate: number | null
          overdue_grace_days: number
          tax_rate: number | null
          updated_at: string
          waitlist_enabled: boolean | null
        }
        Insert: {
          advance_booking_days?: number | null
          auto_attendance_checkout?: boolean | null
          block_access_on_overdue?: boolean
          branch_id: string
          cancellation_fee_rate?: number | null
          checkout_after_hours?: number | null
          created_at?: string
          currency?: string | null
          freeze_fee?: number | null
          freeze_max_days?: number | null
          freeze_min_days?: number | null
          id?: string
          late_fee_rate?: number | null
          overdue_grace_days?: number
          tax_rate?: number | null
          updated_at?: string
          waitlist_enabled?: boolean | null
        }
        Update: {
          advance_booking_days?: number | null
          auto_attendance_checkout?: boolean | null
          block_access_on_overdue?: boolean
          branch_id?: string
          cancellation_fee_rate?: number | null
          checkout_after_hours?: number | null
          created_at?: string
          currency?: string | null
          freeze_fee?: number | null
          freeze_max_days?: number | null
          freeze_min_days?: number | null
          id?: string
          late_fee_rate?: number | null
          overdue_grace_days?: number
          tax_rate?: number | null
          updated_at?: string
          waitlist_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          closing_time: string | null
          code: string
          country: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean | null
          name: string
          opening_time: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          closing_time?: string | null
          code: string
          country?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          opening_time?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          closing_time?: string | null
          code?: string
          country?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      class_bookings: {
        Row: {
          attended_at: string | null
          booked_at: string
          cancellation_reason: string | null
          cancelled_at: string | null
          class_id: string
          created_at: string
          id: string
          member_id: string
          status: Database["public"]["Enums"]["class_booking_status"]
        }
        Insert: {
          attended_at?: string | null
          booked_at?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          class_id: string
          created_at?: string
          id?: string
          member_id: string
          status?: Database["public"]["Enums"]["class_booking_status"]
        }
        Update: {
          attended_at?: string | null
          booked_at?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          class_id?: string
          created_at?: string
          id?: string
          member_id?: string
          status?: Database["public"]["Enums"]["class_booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "class_bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      class_waitlist: {
        Row: {
          added_at: string
          class_id: string
          created_at: string
          id: string
          member_id: string
          notified_at: string | null
          position: number
        }
        Insert: {
          added_at?: string
          class_id: string
          created_at?: string
          id?: string
          member_id: string
          notified_at?: string | null
          position: number
        }
        Update: {
          added_at?: string
          class_id?: string
          created_at?: string
          id?: string
          member_id?: string
          notified_at?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_waitlist_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_waitlist_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          branch_id: string
          capacity: number
          class_type: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          name: string
          recurrence_rule: string | null
          scheduled_at: string
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          capacity: number
          class_type?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name: string
          recurrence_rule?: string | null
          scheduled_at: string
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          capacity?: number
          class_type?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          name?: string
          recurrence_rule?: string | null
          scheduled_at?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_delivery_events: {
        Row: {
          actor_user_id: string | null
          branch_id: string
          channel: string
          communication_log_id: string | null
          created_at: string
          error_message: string | null
          id: string
          member_id: string | null
          metadata: Json
          new_status: Database["public"]["Enums"]["reminder_delivery_status"]
          previous_status:
            | Database["public"]["Enums"]["reminder_delivery_status"]
            | null
          provider: string | null
          provider_message_id: string | null
          reminder_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          branch_id: string
          channel: string
          communication_log_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          member_id?: string | null
          metadata?: Json
          new_status: Database["public"]["Enums"]["reminder_delivery_status"]
          previous_status?:
            | Database["public"]["Enums"]["reminder_delivery_status"]
            | null
          provider?: string | null
          provider_message_id?: string | null
          reminder_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          branch_id?: string
          channel?: string
          communication_log_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          member_id?: string | null
          metadata?: Json
          new_status?: Database["public"]["Enums"]["reminder_delivery_status"]
          previous_status?:
            | Database["public"]["Enums"]["reminder_delivery_status"]
            | null
          provider?: string | null
          provider_message_id?: string | null
          reminder_id?: string | null
        }
        Relationships: []
      }
      communication_logs: {
        Row: {
          attempt_count: number
          branch_id: string
          content: string | null
          created_at: string
          delivery_metadata: Json
          delivery_status: Database["public"]["Enums"]["reminder_delivery_status"]
          error_message: string | null
          id: string
          member_id: string | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string | null
          subject: string | null
          template_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          branch_id: string
          content?: string | null
          created_at?: string
          delivery_metadata?: Json
          delivery_status?: Database["public"]["Enums"]["reminder_delivery_status"]
          error_message?: string | null
          id?: string
          member_id?: string | null
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          branch_id?: string
          content?: string | null
          created_at?: string
          delivery_metadata?: Json
          delivery_status?: Database["public"]["Enums"]["reminder_delivery_status"]
          error_message?: string | null
          id?: string
          member_id?: string | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          template_name: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          template_name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          base_salary: number | null
          commission_percentage: number | null
          contract_type: string
          created_at: string
          document_url: string | null
          employee_id: string
          end_date: string | null
          id: string
          salary: number
          start_date: string
          status: Database["public"]["Enums"]["contract_status"]
          terms: Json | null
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          base_salary?: number | null
          commission_percentage?: number | null
          contract_type: string
          created_at?: string
          document_url?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          salary: number
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: Json | null
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          base_salary?: number | null
          commission_percentage?: number | null
          contract_type?: string
          created_at?: string
          document_url?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          salary?: number
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: Json | null
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      device_access_events: {
        Row: {
          access_granted: boolean
          branch_id: string
          confidence_score: number | null
          created_at: string | null
          denial_reason: string | null
          device_id: string | null
          device_message: string | null
          event_type: string
          id: string
          member_id: string | null
          photo_url: string | null
          processed_at: string | null
          response_sent: string | null
          staff_id: string | null
        }
        Insert: {
          access_granted?: boolean
          branch_id: string
          confidence_score?: number | null
          created_at?: string | null
          denial_reason?: string | null
          device_id?: string | null
          device_message?: string | null
          event_type: string
          id?: string
          member_id?: string | null
          photo_url?: string | null
          processed_at?: string | null
          response_sent?: string | null
          staff_id?: string | null
        }
        Update: {
          access_granted?: boolean
          branch_id?: string
          confidence_score?: number | null
          created_at?: string | null
          denial_reason?: string | null
          device_id?: string | null
          device_message?: string | null
          event_type?: string
          id?: string
          member_id?: string | null
          photo_url?: string | null
          processed_at?: string | null
          response_sent?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_access_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_access_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_access_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_access_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      device_commands: {
        Row: {
          command_type: string
          device_id: string
          executed_at: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          payload: Json | null
          status: string
        }
        Insert: {
          command_type?: string
          device_id: string
          executed_at?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          payload?: Json | null
          status?: string
        }
        Update: {
          command_type?: string
          device_id?: string
          executed_at?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_plans: {
        Row: {
          calories_target: number | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          is_ai_generated: boolean | null
          member_id: string
          name: string
          plan_data: Json
          plan_type: string | null
          start_date: string | null
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          calories_target?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_generated?: boolean | null
          member_id: string
          name: string
          plan_data?: Json
          plan_type?: string | null
          start_date?: string | null
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          calories_target?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_generated?: boolean | null
          member_id?: string
          name?: string
          plan_data?: Json
          plan_type?: string | null
          start_date?: string | null
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_plans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plans_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plans_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_templates: {
        Row: {
          branch_id: string | null
          calories_target: number | null
          created_at: string
          description: string | null
          diet_type: string | null
          id: string
          is_active: boolean | null
          meal_plan: Json
          name: string
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          calories_target?: number | null
          created_at?: string
          description?: string | null
          diet_type?: string | null
          id?: string
          is_active?: boolean | null
          meal_plan?: Json
          name: string
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          calories_target?: number | null
          created_at?: string
          description?: string | null
          diet_type?: string | null
          id?: string
          is_active?: boolean | null
          meal_plan?: Json
          name?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_templates_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_templates_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase: number | null
          times_used: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          times_used?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          times_used?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_orders: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          items: Json
          member_id: string | null
          notes: string | null
          order_number: string
          payment_id: string | null
          shipping_address: Json | null
          shipping_amount: number | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          items?: Json
          member_id?: string | null
          notes?: string | null
          order_number: string
          payment_id?: string | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          items?: Json
          member_id?: string | null
          notes?: string | null
          order_number?: string
          payment_id?: string | null
          shipping_address?: Json | null
          shipping_amount?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar_storage_path: string | null
          bank_account: string | null
          bank_name: string | null
          biometric_enrolled: boolean | null
          biometric_photo_path: string | null
          biometric_photo_url: string | null
          branch_id: string
          created_at: string
          department: string | null
          employee_code: string
          hire_date: string
          id: string
          is_active: boolean | null
          mips_person_id: string | null
          mips_person_sn: string | null
          mips_sync_status: string | null
          position: string | null
          salary: number | null
          salary_type: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
          weekly_off: string | null
        }
        Insert: {
          avatar_storage_path?: string | null
          bank_account?: string | null
          bank_name?: string | null
          biometric_enrolled?: boolean | null
          biometric_photo_path?: string | null
          biometric_photo_url?: string | null
          branch_id: string
          created_at?: string
          department?: string | null
          employee_code: string
          hire_date: string
          id?: string
          is_active?: boolean | null
          mips_person_id?: string | null
          mips_person_sn?: string | null
          mips_sync_status?: string | null
          position?: string | null
          salary?: number | null
          salary_type?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
          weekly_off?: string | null
        }
        Update: {
          avatar_storage_path?: string | null
          bank_account?: string | null
          bank_name?: string | null
          biometric_enrolled?: boolean | null
          biometric_photo_path?: string | null
          biometric_photo_url?: string | null
          branch_id?: string
          created_at?: string
          department?: string | null
          employee_code?: string
          hire_date?: string
          id?: string
          is_active?: boolean | null
          mips_person_id?: string | null
          mips_person_sn?: string | null
          mips_sync_status?: string | null
          position?: string | null
          salary?: number | null
          salary_type?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
          weekly_off?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          branch_id: string
          brand: string | null
          category: string | null
          created_at: string
          id: string
          location: string | null
          model: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          updated_at: string
          warranty_expiry: string | null
        }
        Insert: {
          branch_id: string
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
          warranty_expiry?: string | null
        }
        Update: {
          branch_id?: string
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          updated_at?: string
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string
          description: string | null
          equipment_id: string
          id: string
          maintenance_type: string
          notes: string | null
          performed_by: string | null
          scheduled_date: string | null
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          equipment_id: string
          id?: string
          maintenance_type: string
          notes?: string | null
          performed_by?: string | null
          scheduled_date?: string | null
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          equipment_id?: string
          id?: string
          maintenance_type?: string
          notes?: string | null
          performed_by?: string | null
          scheduled_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          browser_info: string | null
          component_name: string | null
          created_at: string | null
          error_message: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          source: string | null
          stack_trace: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          browser_info?: string | null
          component_name?: string | null
          created_at?: string | null
          error_message: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          source?: string | null
          stack_trace?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          browser_info?: string | null
          component_name?: string | null
          created_at?: string | null
          error_message?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          source?: string | null
          stack_trace?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          calories_per_minute: number | null
          created_at: string | null
          difficulty: string | null
          equipment_type: string | null
          id: string
          image_url: string | null
          instructions: string | null
          is_active: boolean | null
          name: string
          target_muscle: string
          video_url: string | null
        }
        Insert: {
          calories_per_minute?: number | null
          created_at?: string | null
          difficulty?: string | null
          equipment_type?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_active?: boolean | null
          name: string
          target_muscle: string
          video_url?: string | null
        }
        Update: {
          calories_per_minute?: number | null
          created_at?: string | null
          difficulty?: string | null
          equipment_type?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_active?: boolean | null
          name?: string
          target_muscle?: string
          video_url?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      expense_category_templates: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          type?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string
          category_id: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          receipt_url: string | null
          status: Database["public"]["Enums"]["approval_status"]
          submitted_by: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id: string
          category_id?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_by?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string
          category_id?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_by?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          available_days: string[] | null
          benefit_type_id: string
          branch_id: string
          capacity: number
          created_at: string | null
          description: string | null
          gender_access: string
          id: string
          is_active: boolean | null
          name: string
          under_maintenance: boolean | null
          updated_at: string | null
        }
        Insert: {
          available_days?: string[] | null
          benefit_type_id: string
          branch_id: string
          capacity?: number
          created_at?: string | null
          description?: string | null
          gender_access?: string
          id?: string
          is_active?: boolean | null
          name: string
          under_maintenance?: boolean | null
          updated_at?: string | null
        }
        Update: {
          available_days?: string[] | null
          benefit_type_id?: string
          branch_id?: string
          capacity?: number
          created_at?: string | null
          description?: string | null
          gender_access?: string
          id?: string
          is_active?: boolean | null
          name?: string
          under_maintenance?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facilities_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_notes: string | null
          branch_id: string
          category: string | null
          created_at: string | null
          employee_id: string | null
          feedback_text: string | null
          google_review_id: string | null
          id: string
          is_approved_for_google: boolean | null
          member_id: string
          published_to_google_at: string | null
          rating: number
          status: string | null
          trainer_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          branch_id: string
          category?: string | null
          created_at?: string | null
          employee_id?: string | null
          feedback_text?: string | null
          google_review_id?: string | null
          id?: string
          is_approved_for_google?: boolean | null
          member_id: string
          published_to_google_at?: string | null
          rating: number
          status?: string | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          branch_id?: string
          category?: string | null
          created_at?: string | null
          employee_id?: string | null
          feedback_text?: string | null
          google_review_id?: string | null
          id?: string
          is_approved_for_google?: boolean | null
          member_id?: string
          published_to_google_at?: string | null
          rating?: number
          status?: string | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_plan_templates: {
        Row: {
          branch_id: string | null
          content: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          goal: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          content?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          content?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitness_plan_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_activities: {
        Row: {
          action_taken: string
          branch_id: string
          created_at: string | null
          created_by: string | null
          id: string
          next_follow_up_date: string | null
          notes: string | null
          reference_id: string
          reference_type: string
        }
        Insert: {
          action_taken: string
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          next_follow_up_date?: string | null
          notes?: string | null
          reference_id: string
          reference_type: string
        }
        Update: {
          action_taken?: string
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          next_follow_up_date?: string | null
          notes?: string | null
          reference_id?: string
          reference_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_activities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      hardware_access_events: {
        Row: {
          actor_user_id: string | null
          branch_id: string
          created_at: string
          id: string
          member_id: string
          metadata: Json
          new_status: string
          previous_status: string | null
          reason: string | null
          requires_sync: boolean
        }
        Insert: {
          actor_user_id?: string | null
          branch_id: string
          created_at?: string
          id?: string
          member_id: string
          metadata?: Json
          new_status: string
          previous_status?: string | null
          reason?: string | null
          requires_sync?: boolean
        }
        Update: {
          actor_user_id?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          member_id?: string
          metadata?: Json
          new_status?: string
          previous_status?: string | null
          reason?: string | null
          requires_sync?: boolean
        }
        Relationships: []
      }
      hardware_devices: {
        Row: {
          branch_id: string | null
          created_at: string
          device_key: string | null
          device_sn: string
          id: string
          ip_address: string | null
          last_online: string | null
          last_payload: Json | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          device_key?: string | null
          device_sn: string
          id?: string
          ip_address?: string | null
          last_online?: string | null
          last_payload?: Json | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          device_key?: string | null
          device_sn?: string
          id?: string
          ip_address?: string | null
          last_online?: string | null
          last_payload?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hardware_devices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      income_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          branch_id: string | null
          config: Json | null
          created_at: string | null
          credentials: Json | null
          id: string
          integration_type: string
          is_active: boolean | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          config?: Json | null
          created_at?: string | null
          credentials?: Json | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          config?: Json | null
          created_at?: string | null
          credentials?: Json | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          last_restocked_at: string | null
          min_quantity: number | null
          product_id: string
          quantity: number | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          last_restocked_at?: string | null
          min_quantity?: number | null
          product_id: string
          quantity?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          last_restocked_at?: string | null
          min_quantity?: number | null
          product_id?: string
          quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          hsn_code: string | null
          id: string
          invoice_id: string
          quantity: number | null
          reference_id: string | null
          reference_type: string | null
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          hsn_code?: string | null
          id?: string
          invoice_id: string
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          hsn_code?: string | null
          id?: string
          invoice_id?: string
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          branch_id: string
          created_at: string
          created_by: string | null
          customer_gstin: string | null
          discount_amount: number | null
          due_date: string | null
          gst_rate: number | null
          id: string
          invoice_number: string | null
          invoice_type: string | null
          is_gst_invoice: boolean | null
          member_id: string | null
          next_reminder_at: string | null
          notes: string | null
          payment_due_date: string | null
          pos_sale_id: string | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          reminder_sent_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_gstin?: string | null
          discount_amount?: number | null
          due_date?: string | null
          gst_rate?: number | null
          id?: string
          invoice_number?: string | null
          invoice_type?: string | null
          is_gst_invoice?: boolean | null
          member_id?: string | null
          next_reminder_at?: string | null
          notes?: string | null
          payment_due_date?: string | null
          pos_sale_id?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          reminder_sent_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_gstin?: string | null
          discount_amount?: number | null
          due_date?: string | null
          gst_rate?: number | null
          id?: string
          invoice_number?: string | null
          invoice_type?: string | null
          is_gst_invoice?: boolean | null
          member_id?: string | null
          next_reminder_at?: string | null
          notes?: string | null
          payment_due_date?: string | null
          pos_sale_id?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          reminder_sent_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pos_sale_id_fkey"
            columns: ["pos_sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_refunded_by_fkey"
            columns: ["refunded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          actor_id: string | null
          branch_id: string
          created_at: string
          id: string
          lead_id: string
          metadata: Json | null
          notes: string | null
          title: string | null
        }
        Insert: {
          activity_type: string
          actor_id?: string | null
          branch_id: string
          created_at?: string
          id?: string
          lead_id: string
          metadata?: Json | null
          notes?: string | null
          title?: string | null
        }
        Update: {
          activity_type?: string
          actor_id?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          notes?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followups: {
        Row: {
          created_at: string
          followup_date: string
          id: string
          lead_id: string
          next_followup_date: string | null
          notes: string | null
          outcome: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          followup_date: string
          id?: string
          lead_id: string
          next_followup_date?: string | null
          notes?: string | null
          outcome?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          followup_date?: string
          id?: string
          lead_id?: string
          next_followup_date?: string | null
          notes?: string | null
          outcome?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notification_rules: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          lead_welcome_sms: string
          lead_welcome_whatsapp: string
          sms_to_admins: boolean
          sms_to_lead: boolean
          sms_to_managers: boolean
          team_alert_sms: string
          team_alert_whatsapp: string
          updated_at: string
          whatsapp_to_admins: boolean
          whatsapp_to_lead: boolean
          whatsapp_to_managers: boolean
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          lead_welcome_sms?: string
          lead_welcome_whatsapp?: string
          sms_to_admins?: boolean
          sms_to_lead?: boolean
          sms_to_managers?: boolean
          team_alert_sms?: string
          team_alert_whatsapp?: string
          updated_at?: string
          whatsapp_to_admins?: boolean
          whatsapp_to_lead?: boolean
          whatsapp_to_managers?: boolean
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          lead_welcome_sms?: string
          lead_welcome_whatsapp?: string
          sms_to_admins?: boolean
          sms_to_lead?: boolean
          sms_to_managers?: boolean
          team_alert_sms?: string
          team_alert_whatsapp?: string
          updated_at?: string
          whatsapp_to_admins?: boolean
          whatsapp_to_lead?: boolean
          whatsapp_to_managers?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lead_notification_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ad_id: string | null
          assigned_to: string | null
          branch_id: string
          budget: string | null
          campaign_name: string | null
          converted_at: string | null
          converted_member_id: string | null
          created_at: string
          date_of_birth: string | null
          duplicate_of: string | null
          email: string | null
          expected_start_date: string | null
          first_response_at: string | null
          fitness_experience: string | null
          fitness_goal: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          goals: string | null
          id: string
          interested_plan_id: string | null
          landing_page: string | null
          last_contacted_at: string | null
          lost_reason: string | null
          merged_into: string | null
          next_action_at: string | null
          notes: string | null
          owner_id: string | null
          phone: string
          preferred_contact_channel: string
          preferred_time: string | null
          referrer_url: string | null
          score: number
          sla_due_at: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[]
          temperature: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          won_at: string | null
        }
        Insert: {
          ad_id?: string | null
          assigned_to?: string | null
          branch_id: string
          budget?: string | null
          campaign_name?: string | null
          converted_at?: string | null
          converted_member_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          duplicate_of?: string | null
          email?: string | null
          expected_start_date?: string | null
          first_response_at?: string | null
          fitness_experience?: string | null
          fitness_goal?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goals?: string | null
          id?: string
          interested_plan_id?: string | null
          landing_page?: string | null
          last_contacted_at?: string | null
          lost_reason?: string | null
          merged_into?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone: string
          preferred_contact_channel?: string
          preferred_time?: string | null
          referrer_url?: string | null
          score?: number
          sla_due_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          temperature?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          won_at?: string | null
        }
        Update: {
          ad_id?: string | null
          assigned_to?: string | null
          branch_id?: string
          budget?: string | null
          campaign_name?: string | null
          converted_at?: string | null
          converted_member_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          duplicate_of?: string | null
          email?: string | null
          expected_start_date?: string | null
          first_response_at?: string | null
          fitness_experience?: string | null
          fitness_goal?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goals?: string | null
          id?: string
          interested_plan_id?: string | null
          landing_page?: string | null
          last_contacted_at?: string | null
          lost_reason?: string | null
          merged_into?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string
          preferred_contact_channel?: string
          preferred_time?: string | null
          referrer_url?: string | null
          score?: number
          sla_due_at?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          temperature?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locker_assignments: {
        Row: {
          created_at: string
          end_date: string | null
          fee_amount: number | null
          id: string
          is_active: boolean | null
          locker_id: string
          member_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          fee_amount?: number | null
          id?: string
          is_active?: boolean | null
          locker_id: string
          member_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          fee_amount?: number | null
          id?: string
          is_active?: boolean | null
          locker_id?: string
          member_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_assignments_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_assignments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      lockers: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          locker_number: string
          monthly_fee: number | null
          notes: string | null
          size: string | null
          status: Database["public"]["Enums"]["locker_status"]
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          locker_number: string
          monthly_fee?: number | null
          notes?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["locker_status"]
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          locker_number?: string
          monthly_fee?: number | null
          notes?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["locker_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_catalog: {
        Row: {
          branch_id: string | null
          calories: number
          carbs: number
          created_at: string
          created_by: string | null
          cuisine: string
          default_quantity: string | null
          dietary_type: string
          fats: number
          fiber: number
          id: string
          is_active: boolean
          meal_type: string
          name: string
          notes: string | null
          protein: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          created_by?: string | null
          cuisine: string
          default_quantity?: string | null
          dietary_type: string
          fats?: number
          fiber?: number
          id?: string
          is_active?: boolean
          meal_type: string
          name: string
          notes?: string | null
          protein?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          created_by?: string | null
          cuisine?: string
          default_quantity?: string | null
          dietary_type?: string
          fats?: number
          fiber?: number
          id?: string
          is_active?: boolean
          meal_type?: string
          name?: string
          notes?: string | null
          protein?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_catalog_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      member_attendance: {
        Row: {
          branch_id: string
          check_in: string
          check_in_method: string | null
          check_out: string | null
          created_at: string
          force_entry: boolean | null
          force_entry_by: string | null
          force_entry_reason: string | null
          id: string
          member_id: string
          membership_id: string | null
          notes: string | null
        }
        Insert: {
          branch_id: string
          check_in?: string
          check_in_method?: string | null
          check_out?: string | null
          created_at?: string
          force_entry?: boolean | null
          force_entry_by?: string | null
          force_entry_reason?: string | null
          id?: string
          member_id: string
          membership_id?: string | null
          notes?: string | null
        }
        Update: {
          branch_id?: string
          check_in?: string
          check_in_method?: string | null
          check_out?: string | null
          created_at?: string
          force_entry?: boolean | null
          force_entry_by?: string | null
          force_entry_reason?: string | null
          id?: string
          member_id?: string
          membership_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_attendance_force_entry_by_fkey"
            columns: ["force_entry_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_attendance_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      member_benefit_credits: {
        Row: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id: string | null
          created_at: string
          credits_remaining: number
          credits_total: number
          expires_at: string
          id: string
          invoice_id: string | null
          member_id: string
          membership_id: string | null
          package_id: string | null
          purchased_at: string
          updated_at: string
        }
        Insert: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          created_at?: string
          credits_remaining: number
          credits_total: number
          expires_at: string
          id?: string
          invoice_id?: string | null
          member_id: string
          membership_id?: string | null
          package_id?: string | null
          purchased_at?: string
          updated_at?: string
        }
        Update: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          created_at?: string
          credits_remaining?: number
          credits_total?: number
          expires_at?: string
          id?: string
          invoice_id?: string | null
          member_id?: string
          membership_id?: string | null
          package_id?: string | null
          purchased_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_benefit_credits_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_benefit_credits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_benefit_credits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_benefit_credits_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_benefit_credits_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "benefit_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      member_branch_history: {
        Row: {
          approved_by: string | null
          created_at: string
          from_branch_id: string | null
          id: string
          member_id: string
          reason: string | null
          to_branch_id: string
          transfer_date: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          from_branch_id?: string | null
          id?: string
          member_id: string
          reason?: string | null
          to_branch_id: string
          transfer_date?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          from_branch_id?: string | null
          id?: string
          member_id?: string
          reason?: string | null
          to_branch_id?: string
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_branch_history_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_branch_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_branch_history_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      member_comps: {
        Row: {
          benefit_type_id: string
          comp_sessions: number
          created_at: string
          granted_by: string | null
          id: string
          member_id: string
          membership_id: string | null
          reason: string | null
          used_sessions: number
        }
        Insert: {
          benefit_type_id: string
          comp_sessions?: number
          created_at?: string
          granted_by?: string | null
          id?: string
          member_id: string
          membership_id?: string | null
          reason?: string | null
          used_sessions?: number
        }
        Update: {
          benefit_type_id?: string
          comp_sessions?: number
          created_at?: string
          granted_by?: string | null
          id?: string
          member_id?: string
          membership_id?: string | null
          reason?: string | null
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "member_comps_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_comps_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_comps_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_comps_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      member_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_url: string
          id: string
          member_id: string
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_name: string
          file_url: string
          id?: string
          member_id: string
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_url?: string
          id?: string
          member_id?: string
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_fitness_plans: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_custom: boolean | null
          is_public: boolean | null
          member_id: string | null
          plan_data: Json
          plan_name: string
          plan_type: string
          template_id: string | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_custom?: boolean | null
          is_public?: boolean | null
          member_id?: string | null
          plan_data?: Json
          plan_name: string
          plan_type: string
          template_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_custom?: boolean | null
          is_public?: boolean | null
          member_id?: string | null
          plan_data?: Json
          plan_name?: string
          plan_type?: string
          template_id?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_fitness_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_fitness_plans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_lifecycle_events: {
        Row: {
          actor_user_id: string | null
          branch_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          idempotency_key: string | null
          member_id: string
          metadata: Json
          new_state: string | null
          previous_state: string | null
          reason: string | null
          source: string | null
        }
        Insert: {
          actor_user_id?: string | null
          branch_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          member_id: string
          metadata?: Json
          new_state?: string | null
          previous_state?: string | null
          reason?: string | null
          source?: string | null
        }
        Update: {
          actor_user_id?: string | null
          branch_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          member_id?: string
          metadata?: Json
          new_state?: string | null
          previous_state?: string | null
          reason?: string | null
          source?: string | null
        }
        Relationships: []
      }
      member_measurements: {
        Row: {
          abdomen_cm: number | null
          ankle_left_cm: number | null
          ankle_right_cm: number | null
          biceps_left_cm: number | null
          biceps_right_cm: number | null
          body_fat_percentage: number | null
          body_shape_profile: string | null
          calves_cm: number | null
          chest_cm: number | null
          created_at: string
          forearm_left_cm: number | null
          forearm_right_cm: number | null
          front_progress_photo_path: string | null
          gender_presentation: string | null
          height_cm: number | null
          hips_cm: number | null
          id: string
          inseam_cm: number | null
          member_id: string
          neck_cm: number | null
          notes: string | null
          photos: Json | null
          posture_type: string | null
          recorded_at: string
          recorded_by: string | null
          shoulder_cm: number | null
          side_progress_photo_path: string | null
          thighs_left_cm: number | null
          thighs_right_cm: number | null
          torso_length_cm: number | null
          updated_at: string
          waist_cm: number | null
          weight_kg: number | null
          wrist_left_cm: number | null
          wrist_right_cm: number | null
        }
        Insert: {
          abdomen_cm?: number | null
          ankle_left_cm?: number | null
          ankle_right_cm?: number | null
          biceps_left_cm?: number | null
          biceps_right_cm?: number | null
          body_fat_percentage?: number | null
          body_shape_profile?: string | null
          calves_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          forearm_left_cm?: number | null
          forearm_right_cm?: number | null
          front_progress_photo_path?: string | null
          gender_presentation?: string | null
          height_cm?: number | null
          hips_cm?: number | null
          id?: string
          inseam_cm?: number | null
          member_id: string
          neck_cm?: number | null
          notes?: string | null
          photos?: Json | null
          posture_type?: string | null
          recorded_at?: string
          recorded_by?: string | null
          shoulder_cm?: number | null
          side_progress_photo_path?: string | null
          thighs_left_cm?: number | null
          thighs_right_cm?: number | null
          torso_length_cm?: number | null
          updated_at?: string
          waist_cm?: number | null
          weight_kg?: number | null
          wrist_left_cm?: number | null
          wrist_right_cm?: number | null
        }
        Update: {
          abdomen_cm?: number | null
          ankle_left_cm?: number | null
          ankle_right_cm?: number | null
          biceps_left_cm?: number | null
          biceps_right_cm?: number | null
          body_fat_percentage?: number | null
          body_shape_profile?: string | null
          calves_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          forearm_left_cm?: number | null
          forearm_right_cm?: number | null
          front_progress_photo_path?: string | null
          gender_presentation?: string | null
          height_cm?: number | null
          hips_cm?: number | null
          id?: string
          inseam_cm?: number | null
          member_id?: string
          neck_cm?: number | null
          notes?: string | null
          photos?: Json | null
          posture_type?: string | null
          recorded_at?: string
          recorded_by?: string | null
          shoulder_cm?: number | null
          side_progress_photo_path?: string | null
          thighs_left_cm?: number | null
          thighs_right_cm?: number | null
          torso_length_cm?: number | null
          updated_at?: string
          waist_cm?: number | null
          weight_kg?: number | null
          wrist_left_cm?: number | null
          wrist_right_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_measurements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_measurements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_pt_packages: {
        Row: {
          branch_id: string
          created_at: string
          expiry_date: string
          id: string
          member_id: string
          package_id: string
          price_paid: number
          sessions_remaining: number
          sessions_total: number
          sessions_used: number | null
          start_date: string
          status: Database["public"]["Enums"]["pt_package_status"]
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          expiry_date: string
          id?: string
          member_id: string
          package_id: string
          price_paid: number
          sessions_remaining: number
          sessions_total: number
          sessions_used?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["pt_package_status"]
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          expiry_date?: string
          id?: string
          member_id?: string
          package_id?: string
          price_paid?: number
          sessions_remaining?: number
          sessions_total?: number
          sessions_used?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["pt_package_status"]
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_pt_packages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pt_packages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pt_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "pt_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pt_packages_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pt_packages_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          activity_level: string | null
          allergies: string[]
          assigned_trainer_id: string | null
          avatar_storage_path: string | null
          biometric_enrolled: boolean | null
          biometric_photo_path: string | null
          biometric_photo_url: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          cuisine_preference: string | null
          custom_welcome_message: string | null
          dietary_preference: string | null
          equipment_availability: string[]
          fitness_goals: string | null
          fitness_level: string | null
          gstin: string | null
          hardware_access_enabled: boolean | null
          hardware_access_status: string | null
          health_conditions: string | null
          id: string
          injuries_limitations: string | null
          joined_at: string
          lead_id: string | null
          lifecycle_state: string
          member_code: string | null
          mips_person_id: string | null
          mips_person_sn: string | null
          mips_sync_status: string | null
          notes: string | null
          referred_by: string | null
          reward_points: number | null
          source: string | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
          wiegand_code: string | null
        }
        Insert: {
          activity_level?: string | null
          allergies?: string[]
          assigned_trainer_id?: string | null
          avatar_storage_path?: string | null
          biometric_enrolled?: boolean | null
          biometric_photo_path?: string | null
          biometric_photo_url?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          cuisine_preference?: string | null
          custom_welcome_message?: string | null
          dietary_preference?: string | null
          equipment_availability?: string[]
          fitness_goals?: string | null
          fitness_level?: string | null
          gstin?: string | null
          hardware_access_enabled?: boolean | null
          hardware_access_status?: string | null
          health_conditions?: string | null
          id?: string
          injuries_limitations?: string | null
          joined_at?: string
          lead_id?: string | null
          lifecycle_state?: string
          member_code?: string | null
          mips_person_id?: string | null
          mips_person_sn?: string | null
          mips_sync_status?: string | null
          notes?: string | null
          referred_by?: string | null
          reward_points?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
          wiegand_code?: string | null
        }
        Update: {
          activity_level?: string | null
          allergies?: string[]
          assigned_trainer_id?: string | null
          avatar_storage_path?: string | null
          biometric_enrolled?: boolean | null
          biometric_photo_path?: string | null
          biometric_photo_url?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          cuisine_preference?: string | null
          custom_welcome_message?: string | null
          dietary_preference?: string | null
          equipment_availability?: string[]
          fitness_goals?: string | null
          fitness_level?: string | null
          gstin?: string | null
          hardware_access_enabled?: boolean | null
          hardware_access_status?: string | null
          health_conditions?: string | null
          id?: string
          injuries_limitations?: string | null
          joined_at?: string
          lead_id?: string | null
          lifecycle_state?: string
          member_code?: string | null
          mips_person_id?: string | null
          mips_person_sn?: string | null
          mips_sync_status?: string | null
          notes?: string | null
          referred_by?: string | null
          reward_points?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
          wiegand_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_assigned_trainer_id_fkey"
            columns: ["assigned_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_assigned_trainer_id_fkey"
            columns: ["assigned_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_free_days: {
        Row: {
          added_by: string | null
          created_at: string
          days_added: number
          id: string
          membership_id: string
          reason: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          days_added: number
          id?: string
          membership_id: string
          reason: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          days_added?: number
          id?: string
          membership_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_free_days_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_freeze_history: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_frozen: number
          end_date: string
          fee_charged: number | null
          id: string
          membership_id: string
          reason: string | null
          requested_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_frozen: number
          end_date: string
          fee_charged?: number | null
          id?: string
          membership_id: string
          reason?: string | null
          requested_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_frozen?: number
          end_date?: string
          fee_charged?: number | null
          id?: string
          membership_id?: string
          reason?: string | null
          requested_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "membership_freeze_history_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          admission_fee: number | null
          branch_id: string | null
          created_at: string
          description: string | null
          discounted_price: number | null
          display_order: number | null
          duration_days: number
          free_locker_size: string | null
          gst_rate: number | null
          id: string
          includes_free_locker: boolean | null
          is_active: boolean | null
          is_gst_inclusive: boolean | null
          is_transferable: boolean | null
          is_visible_to_members: boolean | null
          max_freeze_days: number | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          admission_fee?: number | null
          branch_id?: string | null
          created_at?: string
          description?: string | null
          discounted_price?: number | null
          display_order?: number | null
          duration_days: number
          free_locker_size?: string | null
          gst_rate?: number | null
          id?: string
          includes_free_locker?: boolean | null
          is_active?: boolean | null
          is_gst_inclusive?: boolean | null
          is_transferable?: boolean | null
          is_visible_to_members?: boolean | null
          max_freeze_days?: number | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          admission_fee?: number | null
          branch_id?: string | null
          created_at?: string
          description?: string | null
          discounted_price?: number | null
          display_order?: number | null
          duration_days?: number
          free_locker_size?: string | null
          gst_rate?: number | null
          id?: string
          includes_free_locker?: boolean | null
          is_active?: boolean | null
          is_gst_inclusive?: boolean | null
          is_transferable?: boolean | null
          is_visible_to_members?: boolean | null
          max_freeze_days?: number | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          branch_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          discount_amount: number | null
          discount_reason: string | null
          end_date: string
          id: string
          is_auto_renew: boolean | null
          member_id: string
          notes: string | null
          original_end_date: string
          plan_id: string
          price_paid: number
          refund_amount: number | null
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
          total_freeze_days_used: number | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          end_date: string
          id?: string
          is_auto_renew?: boolean | null
          member_id: string
          notes?: string | null
          original_end_date: string
          plan_id: string
          price_paid: number
          refund_amount?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["membership_status"]
          total_freeze_days_used?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          end_date?: string
          id?: string
          is_auto_renew?: boolean | null
          member_id?: string
          notes?: string | null
          original_end_date?: string
          plan_id?: string
          price_paid?: number
          refund_amount?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          total_freeze_days_used?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mips_connections: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          is_active: boolean
          password: string
          server_url: string
          updated_at: string | null
          username: string
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          password: string
          server_url: string
          updated_at?: string | null
          username: string
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          password?: string
          server_url?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "mips_connections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_announcements: boolean | null
          email_class_notifications: boolean | null
          email_membership_reminders: boolean | null
          email_payment_receipts: boolean | null
          id: string
          push_low_stock: boolean | null
          push_new_leads: boolean | null
          push_payment_alerts: boolean | null
          push_task_reminders: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_announcements?: boolean | null
          email_class_notifications?: boolean | null
          email_membership_reminders?: boolean | null
          email_payment_receipts?: boolean | null
          id?: string
          push_low_stock?: boolean | null
          push_new_leads?: boolean | null
          push_payment_alerts?: boolean | null
          push_task_reminders?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_announcements?: boolean | null
          email_class_notifications?: boolean | null
          email_membership_reminders?: boolean | null
          email_payment_receipts?: boolean | null
          id?: string
          push_low_stock?: boolean | null
          push_new_leads?: boolean | null
          push_payment_alerts?: boolean | null
          push_task_reminders?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          branch_id: string | null
          category: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          branch_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          ai_tool_config: Json | null
          branch_id: string | null
          created_at: string
          currency: string | null
          fiscal_year_start: string | null
          gst_rates: Json | null
          hsn_defaults: Json | null
          id: string
          lead_nurture_config: Json | null
          logo_url: string | null
          name: string | null
          session_timeout_hours: number | null
          timezone: string | null
          updated_at: string
          webhook_slug: string | null
          website_theme: Json | null
          whatsapp_ai_config: Json | null
        }
        Insert: {
          ai_tool_config?: Json | null
          branch_id?: string | null
          created_at?: string
          currency?: string | null
          fiscal_year_start?: string | null
          gst_rates?: Json | null
          hsn_defaults?: Json | null
          id?: string
          lead_nurture_config?: Json | null
          logo_url?: string | null
          name?: string | null
          session_timeout_hours?: number | null
          timezone?: string | null
          updated_at?: string
          webhook_slug?: string | null
          website_theme?: Json | null
          whatsapp_ai_config?: Json | null
        }
        Update: {
          ai_tool_config?: Json | null
          branch_id?: string | null
          created_at?: string
          currency?: string | null
          fiscal_year_start?: string | null
          gst_rates?: Json | null
          hsn_defaults?: Json | null
          id?: string
          lead_nurture_config?: Json | null
          logo_url?: string | null
          name?: string | null
          session_timeout_hours?: number | null
          timezone?: string | null
          updated_at?: string
          webhook_slug?: string | null
          website_theme?: Json | null
          whatsapp_ai_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_lifecycle_events: {
        Row: {
          actor_user_id: string | null
          branch_id: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          member_id: string | null
          metadata: Json
          new_state: string | null
          payment_id: string | null
          payment_transaction_id: string | null
          previous_state: string | null
          source: string | null
        }
        Insert: {
          actor_user_id?: string | null
          branch_id: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          member_id?: string | null
          metadata?: Json
          new_state?: string | null
          payment_id?: string | null
          payment_transaction_id?: string | null
          previous_state?: string | null
          source?: string | null
        }
        Update: {
          actor_user_id?: string | null
          branch_id?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          member_id?: string | null
          metadata?: Json
          new_state?: string | null
          payment_id?: string | null
          payment_transaction_id?: string | null
          previous_state?: string | null
          source?: string | null
        }
        Relationships: []
      }
      payment_reminders: {
        Row: {
          attempt_count: number
          branch_id: string
          channel: string
          created_at: string | null
          delivery_metadata: Json
          delivery_status: Database["public"]["Enums"]["reminder_delivery_status"]
          id: string
          invoice_id: string
          last_error: string | null
          member_id: string
          reminder_type: string
          scheduled_for: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          attempt_count?: number
          branch_id: string
          channel?: string
          created_at?: string | null
          delivery_metadata?: Json
          delivery_status?: Database["public"]["Enums"]["reminder_delivery_status"]
          id?: string
          invoice_id: string
          last_error?: string | null
          member_id: string
          reminder_type: string
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          attempt_count?: number
          branch_id?: string
          channel?: string
          created_at?: string | null
          delivery_metadata?: Json
          delivery_status?: Database["public"]["Enums"]["reminder_delivery_status"]
          id?: string
          invoice_id?: string
          last_error?: string | null
          member_id?: string
          reminder_type?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          branch_id: string
          created_at: string | null
          currency: string | null
          error_message: string | null
          event_type: string | null
          gateway: string
          gateway_order_id: string | null
          gateway_payment_id: string | null
          gateway_signature: string | null
          http_status: number | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          lifecycle_metadata: Json
          lifecycle_status: Database["public"]["Enums"]["payment_transaction_status"]
          member_id: string | null
          payment_link_url: string | null
          received_at: string | null
          response_body: Json | null
          settled_payment_id: string | null
          signature_verified: boolean | null
          source: string | null
          status: string
          updated_at: string | null
          webhook_data: Json | null
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          event_type?: string | null
          gateway: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gateway_signature?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          lifecycle_metadata?: Json
          lifecycle_status?: Database["public"]["Enums"]["payment_transaction_status"]
          member_id?: string | null
          payment_link_url?: string | null
          received_at?: string | null
          response_body?: Json | null
          settled_payment_id?: string | null
          signature_verified?: boolean | null
          source?: string | null
          status?: string
          updated_at?: string | null
          webhook_data?: Json | null
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          event_type?: string | null
          gateway?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          gateway_signature?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          lifecycle_metadata?: Json
          lifecycle_status?: Database["public"]["Enums"]["payment_transaction_status"]
          member_id?: string | null
          payment_link_url?: string | null
          received_at?: string | null
          response_body?: Json | null
          settled_payment_id?: string | null
          signature_verified?: boolean | null
          source?: string | null
          status?: string
          updated_at?: string | null
          webhook_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          id: string
          idempotency_key: string | null
          income_category_id: string | null
          invoice_id: string | null
          lifecycle_metadata: Json
          lifecycle_status: Database["public"]["Enums"]["payment_transaction_status"]
          member_id: string | null
          notes: string | null
          original_payment_id: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_source: string
          received_by: string | null
          settled_at: string | null
          slip_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          income_category_id?: string | null
          invoice_id?: string | null
          lifecycle_metadata?: Json
          lifecycle_status?: Database["public"]["Enums"]["payment_transaction_status"]
          member_id?: string | null
          notes?: string | null
          original_payment_id?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_source?: string
          received_by?: string | null
          settled_at?: string | null
          slip_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          income_category_id?: string | null
          invoice_id?: string | null
          lifecycle_metadata?: Json
          lifecycle_status?: Database["public"]["Enums"]["payment_transaction_status"]
          member_id?: string | null
          notes?: string | null
          original_payment_id?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_source?: string
          received_by?: string | null
          settled_at?: string | null
          slip_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_income_category_id_fkey"
            columns: ["income_category_id"]
            isOneToOne: false
            referencedRelation: "income_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_rules: {
        Row: {
          branch_id: string
          calculation: Json
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          rule_type: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          calculation: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          rule_type: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          calculation?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      plan_benefits: {
        Row: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id: string | null
          created_at: string
          description: string | null
          frequency: Database["public"]["Enums"]["frequency_type"]
          id: string
          limit_count: number | null
          plan_id: string
          reset_period: string | null
        }
        Insert: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          created_at?: string
          description?: string | null
          frequency: Database["public"]["Enums"]["frequency_type"]
          id?: string
          limit_count?: number | null
          plan_id: string
          reset_period?: string | null
        }
        Update: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          benefit_type_id?: string | null
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["frequency_type"]
          id?: string
          limit_count?: number | null
          plan_id?: string
          reset_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_benefits_benefit_type_id_fkey"
            columns: ["benefit_type_id"]
            isOneToOne: false
            referencedRelation: "benefit_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_benefits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          branch_id: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          invoice_id: string | null
          items: Json
          member_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: string
          sale_date: string
          sold_by: string | null
          total_amount: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          invoice_id?: string | null
          items?: Json
          member_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          sale_date?: string
          sold_by?: string | null
          total_amount: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          invoice_id?: string | null
          items?: Json
          member_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          sale_date?: string
          sold_by?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          branch_id: string | null
          category: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          sku: string | null
          tax_rate: number | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          sku?: string | null
          tax_rate?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          sku?: string | null
          tax_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_storage_path: string | null
          avatar_url: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          government_id_number: string | null
          government_id_type: string | null
          government_id_verified: boolean | null
          id: string
          is_active: boolean | null
          must_set_password: boolean | null
          phone: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_storage_path?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          government_id_number?: string | null
          government_id_type?: string | null
          government_id_verified?: boolean | null
          id: string
          is_active?: boolean | null
          must_set_password?: boolean | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_storage_path?: string | null
          avatar_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          government_id_number?: string | null
          government_id_type?: string | null
          government_id_verified?: boolean | null
          id?: string
          is_active?: boolean | null
          must_set_password?: boolean | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pt_packages: {
        Row: {
          branch_id: string
          created_at: string
          description: string | null
          duration_months: number | null
          gst_inclusive: boolean | null
          gst_percentage: number | null
          id: string
          is_active: boolean | null
          name: string
          package_type: string
          price: number
          session_type: string | null
          total_sessions: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          description?: string | null
          duration_months?: number | null
          gst_inclusive?: boolean | null
          gst_percentage?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          package_type?: string
          price: number
          session_type?: string | null
          total_sessions: number
          updated_at?: string
          validity_days: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          description?: string | null
          duration_months?: number | null
          gst_inclusive?: boolean | null
          gst_percentage?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          package_type?: string
          price?: number
          session_type?: string | null
          total_sessions?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "pt_packages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_sessions: {
        Row: {
          branch_id: string
          cancelled_reason: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          member_pt_package_id: string
          notes: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["pt_session_status"]
          trainer_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          cancelled_reason?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          member_pt_package_id: string
          notes?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["pt_session_status"]
          trainer_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cancelled_reason?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          member_pt_package_id?: string
          notes?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["pt_session_status"]
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_sessions_member_pt_package_id_fkey"
            columns: ["member_pt_package_id"]
            isOneToOne: false
            referencedRelation: "member_pt_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_lifecycle_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          metadata: Json
          new_state: Database["public"]["Enums"]["referral_lifecycle_status"]
          previous_state:
            | Database["public"]["Enums"]["referral_lifecycle_status"]
            | null
          reason: string | null
          referral_id: string
          referred_member_id: string | null
          referrer_member_id: string
          source: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          new_state: Database["public"]["Enums"]["referral_lifecycle_status"]
          previous_state?:
            | Database["public"]["Enums"]["referral_lifecycle_status"]
            | null
          reason?: string | null
          referral_id: string
          referred_member_id?: string | null
          referrer_member_id: string
          source?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          new_state?: Database["public"]["Enums"]["referral_lifecycle_status"]
          previous_state?:
            | Database["public"]["Enums"]["referral_lifecycle_status"]
            | null
          reason?: string | null
          referral_id?: string
          referred_member_id?: string | null
          referrer_member_id?: string
          source?: string | null
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          claim_idempotency_key: string | null
          claimed_at: string | null
          claimed_wallet_txn_id: string | null
          created_at: string
          description: string | null
          id: string
          is_claimed: boolean | null
          member_id: string
          referral_id: string
          reward_type: string
          reward_value: number | null
        }
        Insert: {
          claim_idempotency_key?: string | null
          claimed_at?: string | null
          claimed_wallet_txn_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_claimed?: boolean | null
          member_id: string
          referral_id: string
          reward_type: string
          reward_value?: number | null
        }
        Update: {
          claim_idempotency_key?: string | null
          claimed_at?: string | null
          claimed_wallet_txn_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_claimed?: boolean | null
          member_id?: string
          referral_id?: string
          reward_type?: string
          reward_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          min_membership_value: number | null
          referred_reward_type: string
          referred_reward_value: number
          referrer_reward_type: string
          referrer_reward_value: number
          reward_mode: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          min_membership_value?: number | null
          referred_reward_type?: string
          referred_reward_value?: number
          referrer_reward_type?: string
          referrer_reward_value?: number
          reward_mode?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          min_membership_value?: number | null
          referred_reward_type?: string
          referred_reward_value?: number
          referrer_reward_type?: string
          referrer_reward_value?: number
          reward_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          claimed_at: string | null
          converted_at: string | null
          created_at: string
          id: string
          last_status_change_at: string
          lifecycle_status: Database["public"]["Enums"]["referral_lifecycle_status"]
          metadata: Json
          qualifying_invoice_id: string | null
          referral_code: string | null
          referred_email: string | null
          referred_member_id: string | null
          referred_name: string
          referred_phone: string
          referrer_member_id: string
          rewarded_at: string | null
          status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          claimed_at?: string | null
          converted_at?: string | null
          created_at?: string
          id?: string
          last_status_change_at?: string
          lifecycle_status?: Database["public"]["Enums"]["referral_lifecycle_status"]
          metadata?: Json
          qualifying_invoice_id?: string | null
          referral_code?: string | null
          referred_email?: string | null
          referred_member_id?: string | null
          referred_name: string
          referred_phone: string
          referrer_member_id: string
          rewarded_at?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          claimed_at?: string | null
          converted_at?: string | null
          created_at?: string
          id?: string
          last_status_change_at?: string
          lifecycle_status?: Database["public"]["Enums"]["referral_lifecycle_status"]
          metadata?: Json
          qualifying_invoice_id?: string | null
          referral_code?: string | null
          referred_email?: string | null
          referred_member_id?: string | null
          referred_name?: string
          referred_phone?: string
          referrer_member_id?: string
          rewarded_at?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_member_id_fkey"
            columns: ["referred_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_member_id_fkey"
            columns: ["referrer_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_configurations: {
        Row: {
          branch_id: string
          channel: string
          created_at: string
          days_before: number[] | null
          id: string
          is_enabled: boolean
          reminder_type: string
          template_text: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          channel?: string
          created_at?: string
          days_before?: number[] | null
          id?: string
          is_enabled?: boolean
          reminder_type: string
          template_text?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          channel?: string
          created_at?: string
          days_before?: number[] | null
          id?: string
          is_enabled?: boolean
          reminder_type?: string
          template_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_configurations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_nudge_logs: {
        Row: {
          branch_id: string
          channel: string
          created_at: string
          id: string
          member_id: string
          message_content: string | null
          resolution: string | null
          resolved_at: string | null
          sent_at: string
          stage_level: number
          status: string
          template_id: string | null
        }
        Insert: {
          branch_id: string
          channel?: string
          created_at?: string
          id?: string
          member_id: string
          message_content?: string | null
          resolution?: string | null
          resolved_at?: string | null
          sent_at?: string
          stage_level: number
          status?: string
          template_id?: string | null
        }
        Update: {
          branch_id?: string
          channel?: string
          created_at?: string
          id?: string
          member_id?: string
          message_content?: string | null
          resolution?: string | null
          resolved_at?: string | null
          sent_at?: string
          stage_level?: number
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retention_nudge_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_nudge_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retention_nudge_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "retention_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_templates: {
        Row: {
          branch_id: string | null
          channels: string[] | null
          created_at: string
          days_trigger: number
          id: string
          is_active: boolean
          message_body: string
          stage_level: number
          stage_name: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          channels?: string[] | null
          created_at?: string
          days_trigger: number
          id?: string
          is_active?: boolean
          message_body: string
          stage_level: number
          stage_name: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          channels?: string[] | null
          created_at?: string
          days_trigger?: number
          id?: string
          is_active?: boolean
          message_body?: string
          stage_level?: number
          stage_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards_ledger: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          member_id: string
          points: number
          reason: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          member_id: string
          points: number
          reason: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          member_id?: string
          points?: number
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_lead_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          branch_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message: string
          message_id: string | null
          phone: string
          provider: string
          sent_by: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message: string
          message_id?: string | null
          phone: string
          provider: string
          sent_by?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string
          message_id?: string | null
          phone?: string
          provider?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          branch_id: string
          check_in: string
          check_out: string | null
          created_at: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branches: {
        Row: {
          branch_id: string
          created_at: string
          hire_date: string | null
          id: string
          position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          hire_date?: string | null
          id?: string
          position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          hire_date?: string | null
          id?: string
          position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branches_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          branch_id: string
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          branch_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          branch_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          branch_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          branch_id: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          meta_rejection_reason: string | null
          meta_template_name: string | null
          meta_template_status: string | null
          name: string
          subject: string | null
          type: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          branch_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          meta_rejection_reason?: string | null
          meta_template_name?: string | null
          meta_template_status?: string | null
          name: string
          subject?: string | null
          type: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          branch_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          meta_rejection_reason?: string | null
          meta_template_name?: string | null
          meta_template_status?: string | null
          name?: string
          subject?: string | null
          type?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_availability_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_availability_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_change_requests: {
        Row: {
          created_at: string
          current_trainer_id: string | null
          id: string
          member_id: string
          reason: string | null
          requested_at: string
          requested_trainer_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          current_trainer_id?: string | null
          id?: string
          member_id: string
          reason?: string | null
          requested_at?: string
          requested_trainer_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          current_trainer_id?: string | null
          id?: string
          member_id?: string
          reason?: string | null
          requested_at?: string
          requested_trainer_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_change_requests_current_trainer_id_fkey"
            columns: ["current_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_change_requests_current_trainer_id_fkey"
            columns: ["current_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_change_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_change_requests_requested_trainer_id_fkey"
            columns: ["requested_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_change_requests_requested_trainer_id_fkey"
            columns: ["requested_trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_commissions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          commission_type: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          percentage: number | null
          pt_package_id: string | null
          release_date: string | null
          session_id: string | null
          status: string
          trainer_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          commission_type: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          percentage?: number | null
          pt_package_id?: string | null
          release_date?: string | null
          session_id?: string | null
          status?: string
          trainer_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          commission_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          percentage?: number | null
          pt_package_id?: string | null
          release_date?: string | null
          session_id?: string | null
          status?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_commissions_pt_package_id_fkey"
            columns: ["pt_package_id"]
            isOneToOne: false
            referencedRelation: "member_pt_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_commissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pt_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_commissions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_commissions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          avatar_storage_path: string | null
          bio: string | null
          biometric_enrolled: boolean | null
          biometric_photo_path: string | null
          biometric_photo_url: string | null
          branch_id: string
          certifications: string[] | null
          created_at: string
          fixed_salary: number | null
          government_id_number: string | null
          government_id_type: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          max_clients: number | null
          mips_person_id: string | null
          mips_person_sn: string | null
          mips_sync_status: string | null
          pt_share_percentage: number | null
          salary_type: string | null
          specializations: string[] | null
          trainer_code: string | null
          updated_at: string
          user_id: string
          weekly_off: string | null
        }
        Insert: {
          avatar_storage_path?: string | null
          bio?: string | null
          biometric_enrolled?: boolean | null
          biometric_photo_path?: string | null
          biometric_photo_url?: string | null
          branch_id: string
          certifications?: string[] | null
          created_at?: string
          fixed_salary?: number | null
          government_id_number?: string | null
          government_id_type?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          max_clients?: number | null
          mips_person_id?: string | null
          mips_person_sn?: string | null
          mips_sync_status?: string | null
          pt_share_percentage?: number | null
          salary_type?: string | null
          specializations?: string[] | null
          trainer_code?: string | null
          updated_at?: string
          user_id: string
          weekly_off?: string | null
        }
        Update: {
          avatar_storage_path?: string | null
          bio?: string | null
          biometric_enrolled?: boolean | null
          biometric_photo_path?: string | null
          biometric_photo_url?: string | null
          branch_id?: string
          certifications?: string[] | null
          created_at?: string
          fixed_salary?: number | null
          government_id_number?: string | null
          government_id_type?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          max_clients?: number | null
          mips_person_id?: string | null
          mips_person_sn?: string | null
          mips_sync_status?: string | null
          pt_share_percentage?: number | null
          salary_type?: string | null
          specializations?: string[] | null
          trainer_code?: string | null
          updated_at?: string
          user_id?: string
          weekly_off?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainers_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          txn_type: Database["public"]["Enums"]["wallet_txn_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          txn_type: Database["public"]["Enums"]["wallet_txn_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          txn_type?: Database["public"]["Enums"]["wallet_txn_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          is_active: boolean | null
          member_id: string
          total_credited: number | null
          total_debited: number | null
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          member_id: string
          total_credited?: number | null
          total_debited?: number | null
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          member_id?: string
          total_credited?: number | null
          total_debited?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chat_settings: {
        Row: {
          assigned_to: string | null
          bot_active: boolean | null
          branch_id: string | null
          created_at: string | null
          id: string
          is_unread: boolean | null
          last_nurture_at: string | null
          nurture_retry_count: number | null
          partial_lead_data: Json | null
          paused_at: string | null
          paused_by: string | null
          phone_number: string
          platform: Database["public"]["Enums"]["messaging_platform"]
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          bot_active?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_unread?: boolean | null
          last_nurture_at?: string | null
          nurture_retry_count?: number | null
          partial_lead_data?: Json | null
          paused_at?: string | null
          paused_by?: string | null
          phone_number: string
          platform?: Database["public"]["Enums"]["messaging_platform"]
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          bot_active?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_unread?: boolean | null
          last_nurture_at?: string | null
          nurture_retry_count?: number | null
          partial_lead_data?: Json | null
          paused_at?: string | null
          paused_by?: string | null
          phone_number?: string
          platform?: Database["public"]["Enums"]["messaging_platform"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chat_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          branch_id: string
          contact_name: string | null
          content: string | null
          created_at: string | null
          direction: string
          id: string
          is_internal_note: boolean
          media_url: string | null
          member_id: string | null
          message_type: string
          phone_number: string
          platform: Database["public"]["Enums"]["messaging_platform"]
          platform_message_id: string | null
          sent_by: string | null
          status: string | null
          updated_at: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          branch_id: string
          contact_name?: string | null
          content?: string | null
          created_at?: string | null
          direction: string
          id?: string
          is_internal_note?: boolean
          media_url?: string | null
          member_id?: string | null
          message_type?: string
          phone_number: string
          platform?: Database["public"]["Enums"]["messaging_platform"]
          platform_message_id?: string | null
          sent_by?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          branch_id?: string
          contact_name?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          is_internal_note?: boolean
          media_url?: string | null
          member_id?: string | null
          message_type?: string
          phone_number?: string
          platform?: Database["public"]["Enums"]["messaging_platform"]
          platform_message_id?: string | null
          sent_by?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          branch_id: string | null
          category: string | null
          components: Json | null
          created_at: string | null
          id: string
          language: string | null
          meta_template_id: string | null
          name: string
          quality_score: string | null
          rejected_reason: string | null
          status: string | null
          synced_at: string | null
          waba_id: string
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          components?: Json | null
          created_at?: string | null
          id?: string
          language?: string | null
          meta_template_id?: string | null
          name: string
          quality_score?: string | null
          rejected_reason?: string | null
          status?: string | null
          synced_at?: string | null
          waba_id: string
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          components?: Json | null
          created_at?: string | null
          id?: string
          language?: string | null
          meta_template_id?: string | null
          name?: string
          quality_score?: string | null
          rejected_reason?: string | null
          status?: string | null
          synced_at?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_triggers: {
        Row: {
          branch_id: string | null
          created_at: string
          delay_minutes: number
          event_name: string
          id: string
          is_active: boolean
          template_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          delay_minutes?: number
          event_name: string
          id?: string
          is_active?: boolean
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          delay_minutes?: number
          event_name?: string
          id?: string
          is_active?: boolean
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_triggers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_triggers_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          is_ai_generated: boolean | null
          member_id: string
          name: string
          plan_data: Json
          start_date: string | null
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_generated?: boolean | null
          member_id: string
          name: string
          plan_data?: Json
          start_date?: string | null
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_ai_generated?: boolean | null
          member_id?: string
          name?: string
          plan_data?: Json
          start_date?: string | null
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plans_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          difficulty_level: string | null
          duration_weeks: number | null
          exercises: Json
          goal: string | null
          id: string
          is_active: boolean | null
          name: string
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          difficulty_level?: string | null
          duration_weeks?: number | null
          exercises?: Json
          goal?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          difficulty_level?: string | null
          duration_weeks?: number | null
          exercises?: Json
          goal?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_templates_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_templates_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      crm_messages: {
        Row: {
          branch_id: string | null
          contact_name: string | null
          content: string | null
          created_at: string | null
          direction: string | null
          id: string | null
          member_id: string | null
          message_type: string | null
          phone_number: string | null
          platform: Database["public"]["Enums"]["messaging_platform"] | null
          platform_message_id: string | null
          status: string | null
          updated_at: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          branch_id?: string | null
          contact_name?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string | null
          member_id?: string | null
          message_type?: string | null
          phone_number?: string | null
          platform?: Database["public"]["Enums"]["messaging_platform"] | null
          platform_message_id?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          branch_id?: string | null
          contact_name?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string | null
          member_id?: string | null
          message_type?: string | null
          phone_number?: string | null
          platform?: Database["public"]["Enums"]["messaging_platform"] | null
          platform_message_id?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      mips_connections_safe: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          password: string | null
          server_url: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          password?: never
          server_url?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          password?: never
          server_url?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mips_connections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers_public: {
        Row: {
          avatar_url: string | null
          bio: string | null
          branch_id: string | null
          certifications: string[] | null
          created_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          max_clients: number | null
          specializations: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "trainers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_to_waitlist: {
        Args: { _class_id: string; _member_id: string }
        Returns: Json
      }
      advance_referral_lifecycle: {
        Args: {
          p_actor_user_id?: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_qualifying_invoice_id?: string
          p_reason?: string
          p_referral_id: string
          p_source?: string
          p_target_status: Database["public"]["Enums"]["referral_lifecycle_status"]
        }
        Returns: Json
      }
      assert_measurement_range: {
        Args: { _field: string; _max: number; _min: number; _value: number }
        Returns: number
      }
      auto_expire_memberships: { Args: never; Returns: undefined }
      book_class: {
        Args: { _class_id: string; _member_id: string }
        Returns: Json
      }
      book_facility_slot: {
        Args: {
          p_member_id: string
          p_membership_id: string
          p_slot_id: string
        }
        Returns: Json
      }
      can_access_member_measurement_photo: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      can_access_member_measurements: {
        Args: { _member_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_private_member_media: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      can_access_private_staff_media: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      can_manage_member_lifecycle: {
        Args: { _member_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_private_member_media: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      can_write_member_measurement_photo: {
        Args: { _path: string; _user_id: string }
        Returns: boolean
      }
      can_write_member_measurements: {
        Args: { _member_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_class_booking: {
        Args: { _booking_id: string; _reason?: string }
        Returns: Json
      }
      cancel_facility_slot: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      check_trainer_slot_available: {
        Args: {
          _duration_minutes?: number
          _scheduled_at: string
          _trainer_id: string
        }
        Returns: boolean
      }
      claim_referral_reward: {
        Args: {
          p_actor_user_id?: string
          p_idempotency_key?: string
          p_member_id: string
          p_reward_id: string
        }
        Returns: Json
      }
      complete_pt_session: {
        Args: { _notes?: string; _session_id: string }
        Returns: Json
      }
      ensure_facility_slots: {
        Args: { p_branch_id: string; p_end_date: string; p_start_date: string }
        Returns: undefined
      }
      evaluate_member_access_state: {
        Args: {
          p_actor_user_id?: string
          p_force_sync?: boolean
          p_member_id: string
          p_reason?: string
        }
        Returns: Json
      }
      extract_member_id_from_storage_path: {
        Args: { _path: string }
        Returns: string
      }
      generate_renewal_invoices: { Args: never; Returns: undefined }
      get_inactive_members: {
        Args: { p_branch_id: string; p_days?: number; p_limit?: number }
        Returns: {
          avatar_url: string
          days_absent: number
          email: string
          full_name: string
          last_visit: string
          member_code: string
          member_id: string
          phone: string
        }[]
      }
      get_member_id: { Args: { _user_id: string }; Returns: string }
      get_user_branch: { Args: { _user_id: string }; Returns: string }
      has_active_benefit: {
        Args: {
          _benefit: Database["public"]["Enums"]["benefit_type"]
          _member_id: string
        }
        Returns: boolean
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
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
      issue_referral_reward: {
        Args: {
          p_actor_user_id?: string
          p_idempotency_key?: string
          p_invoice_id: string
          p_referral_id: string
          p_source?: string
        }
        Returns: Json
      }
      log_member_lifecycle_event: {
        Args: {
          _actor_user_id: string
          _branch_id: string
          _entity_id: string
          _entity_type: string
          _event_type: string
          _idempotency_key: string
          _member_id: string
          _metadata?: Json
          _new_state: string
          _previous_state: string
          _reason: string
          _source: string
        }
        Returns: undefined
      }
      manages_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      mark_class_attendance: {
        Args: { _attended: boolean; _booking_id: string }
        Returns: Json
      }
      member_check_in: {
        Args: { _branch_id: string; _member_id: string; _method?: string }
        Returns: Json
      }
      member_check_out: { Args: { _member_id: string }; Returns: Json }
      onboard_member: {
        Args: {
          p_activity_level?: string
          p_allergies?: string[]
          p_avatar_storage_path?: string
          p_branch_id: string
          p_created_by?: string
          p_cuisine_preference?: string
          p_dietary_preference?: string
          p_email: string
          p_equipment_availability?: string[]
          p_fitness_goals?: string
          p_fitness_level?: string
          p_full_name: string
          p_government_id_number?: string
          p_government_id_type?: string
          p_health_conditions?: string
          p_injuries_limitations?: string
          p_phone?: string
          p_referred_by?: string
          p_schedule_welcome?: boolean
          p_source?: string
          p_user_id: string
          p_welcome_channels?: string[]
        }
        Returns: Json
      }
      purchase_member_membership: {
        Args: {
          p_amount_paying?: number
          p_assign_locker_id?: string
          p_branch_id: string
          p_discount_amount?: number
          p_discount_reason?: string
          p_gst_rate?: number
          p_idempotency_key?: string
          p_include_gst?: boolean
          p_member_id: string
          p_notes?: string
          p_payment_due_date?: string
          p_payment_method?: string
          p_payment_source?: string
          p_plan_id: string
          p_received_by?: string
          p_send_reminders?: boolean
          p_start_date: string
        }
        Returns: Json
      }
      purchase_pt_package: {
        Args: {
          _branch_id: string
          _member_id: string
          _package_id: string
          _price_paid: number
          _trainer_id: string
        }
        Returns: Json
      }
      record_member_measurement: {
        Args: { p_member_id: string; p_payload: Json }
        Returns: string
      }
      record_payment: {
        Args: {
          p_amount: number
          p_branch_id: string
          p_income_category_id?: string
          p_invoice_id: string
          p_member_id: string
          p_notes?: string
          p_payment_method: string
          p_received_by?: string
          p_transaction_id?: string
        }
        Returns: Json
      }
      resolve_member_document_url: {
        Args: { p_document_id: string; p_expires_in?: number }
        Returns: string
      }
      search_members: {
        Args: { p_branch_id?: string; p_limit?: number; search_term: string }
        Returns: {
          avatar_url: string
          branch_id: string
          email: string
          full_name: string
          id: string
          member_code: string
          member_status: string
          phone: string
        }[]
      }
      settle_payment: {
        Args: {
          p_amount: number
          p_branch_id: string
          p_gateway_payment_id?: string
          p_idempotency_key?: string
          p_income_category_id?: string
          p_invoice_id: string
          p_member_id: string
          p_metadata?: Json
          p_notes?: string
          p_payment_method: string
          p_payment_source?: string
          p_payment_transaction_id?: string
          p_received_by?: string
          p_transaction_id?: string
        }
        Returns: Json
      }
      validate_class_booking: {
        Args: { _class_id: string; _member_id: string }
        Returns: Json
      }
      validate_member_checkin: {
        Args: { _branch_id: string; _member_id: string }
        Returns: Json
      }
      void_payment: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "trainer" | "staff" | "member"
      approval_status: "pending" | "approved" | "rejected"
      approval_type:
        | "membership_freeze"
        | "membership_transfer"
        | "refund"
        | "discount"
        | "complimentary"
        | "expense"
        | "contract"
        | "comp_gift"
        | "branch_transfer"
      benefit_booking_status:
        | "booked"
        | "confirmed"
        | "attended"
        | "no_show"
        | "cancelled"
      benefit_type:
        | "gym_access"
        | "pool_access"
        | "sauna_access"
        | "steam_access"
        | "group_classes"
        | "pt_sessions"
        | "locker"
        | "towel"
        | "parking"
        | "guest_pass"
        | "other"
        | "ice_bath"
        | "yoga_class"
        | "crossfit_class"
        | "spa_access"
        | "sauna_session"
        | "cardio_area"
        | "functional_training"
      class_booking_status:
        | "booked"
        | "attended"
        | "cancelled"
        | "no_show"
        | "waitlisted"
      contract_status: "draft" | "active" | "completed" | "terminated"
      equipment_status:
        | "operational"
        | "maintenance"
        | "out_of_order"
        | "retired"
      frequency_type:
        | "daily"
        | "weekly"
        | "monthly"
        | "unlimited"
        | "per_membership"
      gender_type: "male" | "female" | "other"
      invoice_status:
        | "draft"
        | "pending"
        | "paid"
        | "partial"
        | "overdue"
        | "cancelled"
        | "refunded"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "negotiation"
        | "converted"
        | "lost"
      locker_status: "available" | "assigned" | "maintenance" | "reserved"
      member_status: "active" | "inactive" | "suspended" | "blacklisted"
      membership_status:
        | "pending"
        | "active"
        | "frozen"
        | "expired"
        | "cancelled"
        | "transferred"
      messaging_platform: "whatsapp" | "instagram" | "messenger"
      no_show_policy: "mark_used" | "allow_reschedule" | "charge_penalty"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned"
      payment_method:
        | "cash"
        | "card"
        | "bank_transfer"
        | "wallet"
        | "upi"
        | "cheque"
        | "other"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      payment_transaction_status:
        | "created"
        | "pending_confirmation"
        | "settled"
        | "failed"
        | "voided"
      pt_package_status: "active" | "expired" | "exhausted" | "cancelled"
      pt_session_status:
        | "scheduled"
        | "completed"
        | "cancelled"
        | "no_show"
        | "rescheduled"
      referral_lifecycle_status:
        | "invited"
        | "joined"
        | "purchased"
        | "converted"
        | "rewarded"
        | "claimed"
      reminder_delivery_status:
        | "scheduled"
        | "sending"
        | "sent"
        | "failed"
        | "skipped"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      wallet_txn_type:
        | "credit"
        | "debit"
        | "refund"
        | "reward"
        | "referral"
        | "adjustment"
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
      app_role: ["owner", "admin", "manager", "trainer", "staff", "member"],
      approval_status: ["pending", "approved", "rejected"],
      approval_type: [
        "membership_freeze",
        "membership_transfer",
        "refund",
        "discount",
        "complimentary",
        "expense",
        "contract",
        "comp_gift",
        "branch_transfer",
      ],
      benefit_booking_status: [
        "booked",
        "confirmed",
        "attended",
        "no_show",
        "cancelled",
      ],
      benefit_type: [
        "gym_access",
        "pool_access",
        "sauna_access",
        "steam_access",
        "group_classes",
        "pt_sessions",
        "locker",
        "towel",
        "parking",
        "guest_pass",
        "other",
        "ice_bath",
        "yoga_class",
        "crossfit_class",
        "spa_access",
        "sauna_session",
        "cardio_area",
        "functional_training",
      ],
      class_booking_status: [
        "booked",
        "attended",
        "cancelled",
        "no_show",
        "waitlisted",
      ],
      contract_status: ["draft", "active", "completed", "terminated"],
      equipment_status: [
        "operational",
        "maintenance",
        "out_of_order",
        "retired",
      ],
      frequency_type: [
        "daily",
        "weekly",
        "monthly",
        "unlimited",
        "per_membership",
      ],
      gender_type: ["male", "female", "other"],
      invoice_status: [
        "draft",
        "pending",
        "paid",
        "partial",
        "overdue",
        "cancelled",
        "refunded",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "negotiation",
        "converted",
        "lost",
      ],
      locker_status: ["available", "assigned", "maintenance", "reserved"],
      member_status: ["active", "inactive", "suspended", "blacklisted"],
      membership_status: [
        "pending",
        "active",
        "frozen",
        "expired",
        "cancelled",
        "transferred",
      ],
      messaging_platform: ["whatsapp", "instagram", "messenger"],
      no_show_policy: ["mark_used", "allow_reschedule", "charge_penalty"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ],
      payment_method: [
        "cash",
        "card",
        "bank_transfer",
        "wallet",
        "upi",
        "cheque",
        "other",
      ],
      payment_status: ["pending", "completed", "failed", "refunded"],
      payment_transaction_status: [
        "created",
        "pending_confirmation",
        "settled",
        "failed",
        "voided",
      ],
      pt_package_status: ["active", "expired", "exhausted", "cancelled"],
      pt_session_status: [
        "scheduled",
        "completed",
        "cancelled",
        "no_show",
        "rescheduled",
      ],
      referral_lifecycle_status: [
        "invited",
        "joined",
        "purchased",
        "converted",
        "rewarded",
        "claimed",
      ],
      reminder_delivery_status: [
        "scheduled",
        "sending",
        "sent",
        "failed",
        "skipped",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      wallet_txn_type: [
        "credit",
        "debit",
        "refund",
        "reward",
        "referral",
        "adjustment",
      ],
    },
  },
} as const

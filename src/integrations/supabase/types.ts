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
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
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
            foreignKeyName: "benefit_usage_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
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
        ]
      }
      branch_settings: {
        Row: {
          advance_booking_days: number | null
          auto_attendance_checkout: boolean | null
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
          tax_rate: number | null
          updated_at: string
          waitlist_enabled: boolean | null
        }
        Insert: {
          advance_booking_days?: number | null
          auto_attendance_checkout?: boolean | null
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
          tax_rate?: number | null
          updated_at?: string
          waitlist_enabled?: boolean | null
        }
        Update: {
          advance_booking_days?: number | null
          auto_attendance_checkout?: boolean | null
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
          city: string | null
          closing_time: string | null
          code: string
          country: string | null
          created_at: string
          email: string | null
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
          city?: string | null
          closing_time?: string | null
          code: string
          country?: string | null
          created_at?: string
          email?: string | null
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
          city?: string | null
          closing_time?: string | null
          code?: string
          country?: string | null
          created_at?: string
          email?: string | null
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
        ]
      }
      communication_logs: {
        Row: {
          branch_id: string
          content: string | null
          created_at: string
          id: string
          member_id: string | null
          recipient: string
          sent_at: string | null
          status: string | null
          subject: string | null
          template_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          branch_id: string
          content?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string
          content?: string | null
          created_at?: string
          id?: string
          member_id?: string | null
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
      contracts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
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
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
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
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
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
          bank_account: string | null
          bank_name: string | null
          branch_id: string
          created_at: string
          department: string | null
          employee_code: string
          hire_date: string
          id: string
          is_active: boolean | null
          position: string | null
          salary: number | null
          salary_type: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          branch_id: string
          created_at?: string
          department?: string | null
          employee_code: string
          hire_date: string
          id?: string
          is_active?: boolean | null
          position?: string | null
          salary?: number | null
          salary_type?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          branch_id?: string
          created_at?: string
          department?: string | null
          employee_code?: string
          hire_date?: string
          id?: string
          is_active?: boolean | null
          position?: string | null
          salary?: number | null
          salary_type?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
          discount_amount: number | null
          due_date: string | null
          id: string
          invoice_number: string
          member_id: string | null
          notes: string | null
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
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number: string
          member_id?: string | null
          notes?: string | null
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
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          member_id?: string | null
          notes?: string | null
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
      leads: {
        Row: {
          assigned_to: string | null
          branch_id: string
          converted_at: string | null
          converted_member_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          interested_plan_id: string | null
          notes: string | null
          phone: string
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          branch_id: string
          converted_at?: string | null
          converted_member_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          interested_plan_id?: string | null
          notes?: string | null
          phone: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          branch_id?: string
          converted_at?: string | null
          converted_member_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          interested_plan_id?: string | null
          notes?: string | null
          phone?: string
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
      member_attendance: {
        Row: {
          branch_id: string
          check_in: string
          check_in_method: string | null
          check_out: string | null
          created_at: string
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
        ]
      }
      members: {
        Row: {
          branch_id: string
          created_at: string
          fitness_goals: string | null
          health_conditions: string | null
          id: string
          joined_at: string
          lead_id: string | null
          member_code: string
          notes: string | null
          referred_by: string | null
          source: string | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          fitness_goals?: string | null
          health_conditions?: string | null
          id?: string
          joined_at?: string
          lead_id?: string | null
          member_code: string
          notes?: string | null
          referred_by?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          fitness_goals?: string | null
          health_conditions?: string | null
          id?: string
          joined_at?: string
          lead_id?: string | null
          member_code?: string
          notes?: string | null
          referred_by?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
          id: string
          is_active: boolean | null
          is_transferable: boolean | null
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
          id?: string
          is_active?: boolean | null
          is_transferable?: boolean | null
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
          id?: string
          is_active?: boolean | null
          is_transferable?: boolean | null
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
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
          total_freeze_days_used: number | null
          updated_at: string
        }
        Insert: {
          branch_id: string
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
          start_date: string
          status?: Database["public"]["Enums"]["membership_status"]
          total_freeze_days_used?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
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
      payments: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          id: string
          invoice_id: string | null
          member_id: string | null
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          member_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          member_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          received_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
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
          created_at: string
          description: string | null
          frequency: Database["public"]["Enums"]["frequency_type"]
          id: string
          limit_count: number | null
          plan_id: string
        }
        Insert: {
          benefit_type: Database["public"]["Enums"]["benefit_type"]
          created_at?: string
          description?: string | null
          frequency: Database["public"]["Enums"]["frequency_type"]
          id?: string
          limit_count?: number | null
          plan_id: string
        }
        Update: {
          benefit_type?: Database["public"]["Enums"]["benefit_type"]
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["frequency_type"]
          id?: string
          limit_count?: number | null
          plan_id?: string
        }
        Relationships: [
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
          id: string
          invoice_id: string | null
          items: Json
          member_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_date: string
          sold_by: string | null
          total_amount: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          items?: Json
          member_id?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_date?: string
          sold_by?: string | null
          total_amount: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          items?: Json
          member_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
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
      products: {
        Row: {
          branch_id: string | null
          category: string | null
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
        ]
      }
      profiles: {
        Row: {
          address: string | null
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
          id: string
          is_active: boolean | null
          name: string
          price: number
          total_sessions: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          total_sessions: number
          updated_at?: string
          validity_days: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
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
        ]
      }
      referral_rewards: {
        Row: {
          claimed_at: string | null
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
          claimed_at?: string | null
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
          claimed_at?: string | null
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
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          id: string
          referred_email: string | null
          referred_member_id: string | null
          referred_name: string
          referred_phone: string
          referrer_member_id: string
          status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_member_id?: string | null
          referred_name: string
          referred_phone: string
          referrer_member_id: string
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_member_id?: string | null
          referred_name?: string
          referred_phone?: string
          referrer_member_id?: string
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
        ]
      }
      trainers: {
        Row: {
          bio: string | null
          branch_id: string
          certifications: string[] | null
          created_at: string
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          specializations: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          branch_id: string
          certifications?: string[] | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          specializations?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          branch_id?: string
          certifications?: string[] | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          specializations?: string[] | null
          updated_at?: string
          user_id?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      manages_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      member_check_in: {
        Args: { _branch_id: string; _member_id: string; _method?: string }
        Returns: Json
      }
      member_check_out: { Args: { _member_id: string }; Returns: Json }
      validate_member_checkin: {
        Args: { _branch_id: string; _member_id: string }
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
      frequency_type: "daily" | "weekly" | "monthly" | "unlimited"
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
      pt_package_status: "active" | "expired" | "exhausted" | "cancelled"
      pt_session_status:
        | "scheduled"
        | "completed"
        | "cancelled"
        | "no_show"
        | "rescheduled"
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
      frequency_type: ["daily", "weekly", "monthly", "unlimited"],
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
      ],
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
      pt_package_status: ["active", "expired", "exhausted", "cancelled"],
      pt_session_status: [
        "scheduled",
        "completed",
        "cancelled",
        "no_show",
        "rescheduled",
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

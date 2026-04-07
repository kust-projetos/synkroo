export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ChannelType = 'whatsapp' | 'instagram' | 'web' | 'telegram'

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type ConversationStatus = 'active' | 'waiting' | 'closed' | 'escalated'

export type MessageDirection = 'inbound' | 'outbound'

export type MessageType = 'text' | 'image' | 'audio' | 'document' | 'video'

export type UserRole = 'owner' | 'admin' | 'dentist' | 'receptionist'

export interface Database {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string
          name: string
          slug: string
          phone: string
          email: string
          website: string | null
          address: Json | null
          settings: Json | null
          subscription_plan: string | null
          subscription_status: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          phone: string
          email: string
          website?: string | null
          address?: Json | null
          settings?: Json | null
          subscription_plan?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          phone?: string
          email?: string
          website?: string | null
          address?: Json | null
          settings?: Json | null
          subscription_plan?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      users: {
        Row: {
          id: string
          clinic_id: string
          email: string
          name: string
          role: UserRole
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          email: string
          name: string
          role?: UserRole
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          email?: string
          name?: string
          role?: UserRole
          phone?: string | null
          avatar_url?: string | null
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      patients: {
        Row: {
          id: string
          clinic_id: string
          name: string
          phone: string
          email: string | null
          cpf: string | null
          birth_date: string | null
          gender: string | null
          address: Json | null
          notes: string | null
          tags: string[] | null
          risk_score: number | null
          last_visit_at: string | null
          opt_out_marketing: boolean | null
          opt_out_reminders: boolean | null
          opt_out_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          phone: string
          email?: string | null
          cpf?: string | null
          birth_date?: string | null
          gender?: string | null
          address?: Json | null
          notes?: string | null
          tags?: string[] | null
          risk_score?: number | null
          last_visit_at?: string | null
          opt_out_marketing?: boolean | null
          opt_out_reminders?: boolean | null
          opt_out_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          phone?: string
          email?: string | null
          cpf?: string | null
          birth_date?: string | null
          gender?: string | null
          address?: Json | null
          notes?: string | null
          tags?: string[] | null
          risk_score?: number | null
          last_visit_at?: string | null
          opt_out_marketing?: boolean | null
          opt_out_reminders?: boolean | null
          opt_out_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      dentists: {
        Row: {
          id: string
          clinic_id: string
          name: string
          phone: string | null
          email: string | null
          cro: string | null
          specialty: string | null
          avatar_url: string | null
          is_active: boolean
          working_hours: Json | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          phone?: string | null
          email?: string | null
          cro?: string | null
          specialty?: string | null
          avatar_url?: string | null
          is_active?: boolean
          working_hours?: Json | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          cro?: string | null
          specialty?: string | null
          avatar_url?: string | null
          is_active?: boolean
          working_hours?: Json | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      procedures: {
        Row: {
          id: string
          clinic_id: string
          name: string
          description: string | null
          duration_minutes: number | null
          price: number | null
          category: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          description?: string | null
          duration_minutes?: number | null
          price?: number | null
          category?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          description?: string | null
          duration_minutes?: number | null
          price?: number | null
          category?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      appointments: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          dentist_id: string | null
          procedure_id: string | null
          scheduled_at: string
          duration_minutes: number
          status: AppointmentStatus
          notes: string | null
          confirmation_sent_at: string | null
          reminder_sent_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          dentist_id?: string | null
          procedure_id?: string | null
          scheduled_at: string
          duration_minutes?: number
          status?: AppointmentStatus
          notes?: string | null
          confirmation_sent_at?: string | null
          reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          dentist_id?: string | null
          procedure_id?: string | null
          scheduled_at?: string
          duration_minutes?: number
          status?: AppointmentStatus
          notes?: string | null
          confirmation_sent_at?: string | null
          reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      conversations: {
        Row: {
          id: string
          clinic_id: string
          channel: ChannelType
          external_id: string
          patient_id: string | null
          status: ConversationStatus
          assigned_to: string | null
          last_message_at: string | null
          message_count: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          channel: ChannelType
          external_id: string
          patient_id?: string | null
          status?: ConversationStatus
          assigned_to?: string | null
          last_message_at?: string | null
          message_count?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          channel?: ChannelType
          external_id?: string
          patient_id?: string | null
          status?: ConversationStatus
          assigned_to?: string | null
          last_message_at?: string | null
          message_count?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          direction: MessageDirection
          content: string
          message_type: MessageType
          media_url: string | null
          metadata: Json | null
          intent: string | null
          entities: Json | null
          confidence: number | null
          is_ai: boolean
          delivered_at: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          direction: MessageDirection
          content: string
          message_type?: MessageType
          media_url?: string | null
          metadata?: Json | null
          intent?: string | null
          entities?: Json | null
          confidence?: number | null
          is_ai?: boolean
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          direction?: MessageDirection
          content?: string
          message_type?: MessageType
          media_url?: string | null
          metadata?: Json | null
          intent?: string | null
          entities?: Json | null
          confidence?: number | null
          is_ai?: boolean
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string
        }
      }
      knowledge_base: {
        Row: {
          id: string
          clinic_id: string
          category: string
          question: string
          answer: string
          keywords: string[] | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          category: string
          question: string
          answer: string
          keywords?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          category?: string
          question?: string
          answer?: string
          keywords?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      message_templates: {
        Row: {
          id: string
          clinic_id: string
          name: string
          category: string
          content: string
          variables: string[] | null
          meta_template_id: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          category: string
          content: string
          variables?: string[] | null
          meta_template_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          category?: string
          content?: string
          variables?: string[] | null
          meta_template_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      budgets: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          appointment_id: string | null
          title: string | null
          description: string | null
          total_value: number
          discount_percent: number
          discount_value: number
          final_value: number
          status: string
          valid_until: string | null
          sent_at: string | null
          responded_at: string | null
          converted_at: string | null
          conversion_appointment_id: string | null
          notes: string | null
          follow_up_sequence: number
          next_follow_up_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          appointment_id?: string | null
          title?: string | null
          description?: string | null
          total_value: number
          discount_percent?: number
          discount_value?: number
          final_value: number
          status?: string
          valid_until?: string | null
          sent_at?: string | null
          responded_at?: string | null
          converted_at?: string | null
          conversion_appointment_id?: string | null
          notes?: string | null
          follow_up_sequence?: number
          next_follow_up_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          appointment_id?: string | null
          title?: string | null
          description?: string | null
          total_value?: number
          discount_percent?: number
          discount_value?: number
          final_value?: number
          status?: string
          valid_until?: string | null
          sent_at?: string | null
          responded_at?: string | null
          converted_at?: string | null
          conversion_appointment_id?: string | null
          notes?: string | null
          follow_up_sequence?: number
          next_follow_up_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      budget_items: {
        Row: {
          id: string
          budget_id: string
          procedure_id: string | null
          procedure_name: string
          quantity: number
          unit_price: number
          discount_percent: number
          total_price: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          procedure_id?: string | null
          procedure_name: string
          quantity?: number
          unit_price: number
          discount_percent?: number
          total_price: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          procedure_id?: string | null
          procedure_name?: string
          quantity?: number
          unit_price?: number
          discount_percent?: number
          total_price?: number
          notes?: string | null
          created_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          clinic_id: string
          name: string
          description: string | null
          campaign_type: string
          target_segment: string | null
          message_template: string
          channel: string
          status: string
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          total_recipients: number
          sent_count: number
          response_count: number
          conversion_count: number
          opt_out_count: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          description?: string | null
          campaign_type: string
          target_segment?: string | null
          message_template: string
          channel?: string
          status?: string
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          total_recipients?: number
          sent_count?: number
          response_count?: number
          conversion_count?: number
          opt_out_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          description?: string | null
          campaign_type?: string
          target_segment?: string | null
          message_template?: string
          channel?: string
          status?: string
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          total_recipients?: number
          sent_count?: number
          response_count?: number
          conversion_count?: number
          opt_out_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string | null
          name: string
          phone: string
          email: string | null
          source: string
          campaign_id: string | null
          status: string
          temperature: string
          score: number
          interest: string | null
          has_budget: boolean | null
          has_timeline: boolean | null
          assigned_to: string | null
          last_contact_at: string | null
          next_followup_at: string | null
          contact_count: number
          converted_at: string | null
          converted_appointment_id: string | null
          lost_reason: string | null
          lost_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id?: string | null
          name: string
          phone: string
          email?: string | null
          source?: string
          campaign_id?: string | null
          status?: string
          temperature?: string
          score?: number
          interest?: string | null
          has_budget?: boolean | null
          has_timeline?: boolean | null
          assigned_to?: string | null
          last_contact_at?: string | null
          next_followup_at?: string | null
          contact_count?: number
          converted_at?: string | null
          converted_appointment_id?: string | null
          lost_reason?: string | null
          lost_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string | null
          name?: string
          phone?: string
          email?: string | null
          source?: string
          campaign_id?: string | null
          status?: string
          temperature?: string
          score?: number
          interest?: string | null
          has_budget?: boolean | null
          has_timeline?: boolean | null
          assigned_to?: string | null
          last_contact_at?: string | null
          next_followup_at?: string | null
          contact_count?: number
          converted_at?: string | null
          converted_appointment_id?: string | null
          lost_reason?: string | null
          lost_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      schedule_blocks: {
        Row: {
          id: string
          clinic_id: string
          dentist_id: string | null
          day_of_week: number | null
          start_time: string
          end_time: string
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          dentist_id?: string | null
          day_of_week?: number | null
          start_time: string
          end_time: string
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          dentist_id?: string | null
          day_of_week?: number | null
          start_time?: string
          end_time?: string
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      follow_ups: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          appointment_id: string | null
          type: string
          scheduled_at: string
          sent_at: string | null
          status: string
          content: string | null
          response: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          appointment_id?: string | null
          type: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          content?: string | null
          response?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          appointment_id?: string | null
          type?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          content?: string | null
          response?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      whatsapp_instances: {
        Row: {
          id: string
          clinic_id: string
          phone_number_id: string
          business_account_id: string | null
          display_name: string | null
          quality_rating: string | null
          status: string
          last_connected_at: string | null
          instance_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          phone_number_id: string
          business_account_id?: string | null
          display_name?: string | null
          quality_rating?: string | null
          status?: string
          last_connected_at?: string | null
          instance_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          phone_number_id?: string
          business_account_id?: string | null
          display_name?: string | null
          quality_rating?: string | null
          status?: string
          last_connected_at?: string | null
          instance_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      patient_risk_scores: {
        Row: {
          id: string
          patient_id: string
          score: number
          factors: Json | null
          calculated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          score: number
          factors?: Json | null
          calculated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          score?: number
          factors?: Json | null
          calculated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          clinic_id: string | null
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id?: string | null
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string | null
          user_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      waitlist: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          dentist_id: string | null
          preferred_date: string | null
          preferred_time_start: string | null
          preferred_time_end: string | null
          priority: number
          notes: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          dentist_id?: string | null
          preferred_date?: string | null
          preferred_time_start?: string | null
          preferred_time_end?: string | null
          priority?: number
          notes?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          dentist_id?: string | null
          preferred_date?: string | null
          preferred_time_start?: string | null
          preferred_time_end?: string | null
          priority?: number
          notes?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      procedure_guidelines: {
        Row: {
          id: string
          clinic_id: string
          procedure_id: string | null
          procedure_name: string
          title: string
          instructions: string
          emergency_contact: boolean
          recovery_time_days: number | null
          restrictions: string[] | null
          warning_signs: string[] | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          procedure_id?: string | null
          procedure_name: string
          title: string
          instructions: string
          emergency_contact?: boolean
          recovery_time_days?: number | null
          restrictions?: string[] | null
          warning_signs?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          procedure_id?: string | null
          procedure_name?: string
          title?: string
          instructions?: string
          emergency_contact?: boolean
          recovery_time_days?: number | null
          restrictions?: string[] | null
          warning_signs?: string[] | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      patient_feedback: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          appointment_id: string | null
          feedback_type: string
          rating: number | null
          nps_score: number | null
          would_recommend: boolean | null
          comments: string | null
          improvements: string[] | null
          collected_at: string
          channel: string
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          appointment_id?: string | null
          feedback_type?: string
          rating?: number | null
          nps_score?: number | null
          would_recommend?: boolean | null
          comments?: string | null
          improvements?: string[] | null
          collected_at?: string
          channel?: string
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          appointment_id?: string | null
          feedback_type?: string
          rating?: number | null
          nps_score?: number | null
          would_recommend?: boolean | null
          comments?: string | null
          improvements?: string[] | null
          collected_at?: string
          channel?: string
          created_at?: string
        }
      }
      campaign_recipients: {
        Row: {
          id: string
          campaign_id: string
          patient_id: string
          status: string
          sent_at: string | null
          delivered_at: string | null
          responded_at: string | null
          response_content: string | null
          converted_at: string | null
          conversion_appointment_id: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          patient_id: string
          status?: string
          sent_at?: string | null
          delivered_at?: string | null
          responded_at?: string | null
          response_content?: string | null
          converted_at?: string | null
          conversion_appointment_id?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          patient_id?: string
          status?: string
          sent_at?: string | null
          delivered_at?: string | null
          responded_at?: string | null
          response_content?: string | null
          converted_at?: string | null
          conversion_appointment_id?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
      treatment_plans: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          title: string
          description: string | null
          total_sessions: number
          completed_sessions: number
          status: string
          started_at: string | null
          expected_completion_at: string | null
          completed_at: string | null
          last_session_at: string | null
          next_session_due_at: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          title: string
          description?: string | null
          total_sessions?: number
          completed_sessions?: number
          status?: string
          started_at?: string | null
          expected_completion_at?: string | null
          completed_at?: string | null
          last_session_at?: string | null
          next_session_due_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          title?: string
          description?: string | null
          total_sessions?: number
          completed_sessions?: number
          status?: string
          started_at?: string | null
          expected_completion_at?: string | null
          completed_at?: string | null
          last_session_at?: string | null
          next_session_due_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      treatment_plan_items: {
        Row: {
          id: string
          treatment_plan_id: string
          procedure_id: string | null
          procedure_name: string
          session_number: number
          appointment_id: string | null
          status: string
          scheduled_at: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          treatment_plan_id: string
          procedure_id?: string | null
          procedure_name: string
          session_number: number
          appointment_id?: string | null
          status?: string
          scheduled_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          treatment_plan_id?: string
          procedure_id?: string | null
          procedure_name?: string
          session_number?: number
          appointment_id?: string | null
          status?: string
          scheduled_at?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      follow_up_configs: {
        Row: {
          id: string
          clinic_id: string
          config_type: string
          procedure_id: string | null
          procedure_name: string | null
          delay_hours: number | null
          delay_days: number | null
          delay_months: number | null
          message_template: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          config_type: string
          procedure_id?: string | null
          procedure_name?: string | null
          delay_hours?: number | null
          delay_days?: number | null
          delay_months?: number | null
          message_template: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          config_type?: string
          procedure_id?: string | null
          procedure_name?: string | null
          delay_hours?: number | null
          delay_days?: number | null
          delay_months?: number | null
          message_template?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string
          activity_type: string
          description: string | null
          performed_by: string | null
          performed_at: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          activity_type: string
          description?: string | null
          performed_by?: string | null
          performed_at?: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          activity_type?: string
          description?: string | null
          performed_by?: string | null
          performed_at?: string
          metadata?: Json | null
          created_at?: string
        }
      }
      conversation_memories: {
        Row: {
          id: string
          clinic_id: string
          conversation_id: string | null
          patient_id: string | null
          content: string
          content_type: string
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          conversation_id?: string | null
          patient_id?: string | null
          content: string
          content_type?: string
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          conversation_id?: string | null
          patient_id?: string | null
          content?: string
          content_type?: string
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      conversation_sessions: {
        Row: {
          id: string
          conversation_id: string
          entries: Json
          extracted_info: Json
          created_at: string
          last_activity_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          entries?: Json
          extracted_info?: Json
          created_at?: string
          last_activity_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          entries?: Json
          extracted_info?: Json
          created_at?: string
          last_activity_at?: string
        }
      }
      pending_actions: {
        Row: {
          id: string
          clinic_id: string
          conversation_id: string | null
          patient_id: string | null
          appointment_id: string | null
          action_type: string
          risk_score: number
          risk_level: string
          status: string
          snapshot_before: Json | null
          snapshot_after: Json | null
          undo_payload: Json | null
          confirmation_count: number
          max_confirmations: number
          confirmed_at: string | null
          undo_deadline: string
          undone_at: string | null
          reasoning: string | null
          agent_intent: string | null
          confidence: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          conversation_id?: string | null
          patient_id?: string | null
          appointment_id?: string | null
          action_type: string
          risk_score?: number
          risk_level?: string
          status?: string
          snapshot_before?: Json | null
          snapshot_after?: Json | null
          undo_payload?: Json | null
          confirmation_count?: number
          max_confirmations?: number
          confirmed_at?: string | null
          undo_deadline: string
          undone_at?: string | null
          reasoning?: string | null
          agent_intent?: string | null
          confidence?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          conversation_id?: string | null
          patient_id?: string | null
          appointment_id?: string | null
          action_type?: string
          risk_score?: number
          risk_level?: string
          status?: string
          snapshot_before?: Json | null
          snapshot_after?: Json | null
          undo_payload?: Json | null
          confirmation_count?: number
          max_confirmations?: number
          confirmed_at?: string | null
          undo_deadline?: string
          undone_at?: string | null
          reasoning?: string | null
          agent_intent?: string | null
          confidence?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      decision_logs: {
        Row: {
          id: string
          clinic_id: string
          conversation_id: string | null
          patient_id: string | null
          intent_classified: string
          confidence_score: number
          action_taken: string
          risk_level: string
          reasoning: string
          escalation_triggered: boolean
          human_override: boolean
          message_summary: string | null
          entities_extracted: Json | null
          rag_sources: Json | null
          response_time_ms: number | null
          tokens_used: number | null
          llm_model: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          conversation_id?: string | null
          patient_id?: string | null
          intent_classified: string
          confidence_score: number
          action_taken: string
          risk_level?: string
          reasoning: string
          escalation_triggered?: boolean
          human_override?: boolean
          message_summary?: string | null
          entities_extracted?: Json | null
          rag_sources?: Json | null
          response_time_ms?: number | null
          tokens_used?: number | null
          llm_model?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          conversation_id?: string | null
          patient_id?: string | null
          intent_classified?: string
          confidence_score?: number
          action_taken?: string
          risk_level?: string
          reasoning?: string
          escalation_triggered?: boolean
          human_override?: boolean
          message_summary?: string | null
          entities_extracted?: Json | null
          rag_sources?: Json | null
          response_time_ms?: number | null
          tokens_used?: number | null
          llm_model?: string | null
          created_at?: string
        }
      }
      smart_trigger_log: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          appointment_id: string | null
          trigger_type: string
          priority: number
          message_sent: string | null
          channel: string
          status: string
          patient_responded: boolean
          response_at: string | null
          patient_response: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          appointment_id?: string | null
          trigger_type: string
          priority?: number
          message_sent?: string | null
          channel?: string
          status?: string
          patient_responded?: boolean
          response_at?: string | null
          patient_response?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          patient_id?: string
          appointment_id?: string | null
          trigger_type?: string
          priority?: number
          message_sent?: string | null
          channel?: string
          status?: string
          patient_responded?: boolean
          response_at?: string | null
          patient_response?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      get_availability: {
        Args: {
          p_clinic_id: string
          p_dentist_id: string
          p_date: string
          p_duration_minutes?: number
        }
        Returns: Array<{ start_time: string; end_time: string }>
      }
      get_or_create_conversation: {
        Args: {
          p_clinic_id: string
          p_channel: string
          p_external_id: string
          p_patient_phone?: string
        }
        Returns: string
      }
      get_conversation_context: {
        Args: {
          p_conversation_id: string
          p_limit?: number
        }
        Returns: Array<{
          role: string
          content: string
          intent: string | null
          created_at: string
        }>
      }
      get_patient_insights: {
        Args: {
          p_patient_id: string
        }
        Returns: Json
      }
      search_knowledge_base: {
        Args: {
          query_embedding: string
          p_clinic_id: string
          match_threshold?: number
          match_count?: number
        }
        Returns: Array<{
          id: string
          category: string
          question: string
          answer: string
          similarity: number
        }>
      }
      search_conversation_memories: {
        Args: {
          query_embedding: string
          p_clinic_id: string
          p_patient_id?: string
          match_threshold?: number
          match_count?: number
        }
        Returns: Array<{
          id: string
          conversation_id: string
          patient_id: string
          content: string
          content_type: string
          similarity: number
          created_at: string
        }>
      }
      store_message_with_embedding: {
        Args: {
          p_conversation_id: string
          p_direction: string
          p_content: string
          p_embedding: string
          p_intent?: string
          p_entities?: Json
        }
        Returns: string
      }
      summarize_conversation: {
        Args: {
          p_conversation_id: string
          p_summary: string
          p_embedding: string
        }
        Returns: string
      }
      calculate_patient_risk_score: {
        Args: {
          patient_uuid: string
        }
        Returns: number
      }
      cleanup_expired_pending_actions: {
        Args: Record<string, never>
        Returns: undefined
      }
      cleanup_old_decision_logs: {
        Args: Record<string, never>
        Returns: undefined
      }
      cleanup_expired_conversation_sessions: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
  }
}

// ============================================
// Convenience Type Exports
// ============================================
// These allow cleaner imports like:
// import { Patient } from '@/lib/supabase/database.types'
// instead of:
// import type { Database } from '@/lib/supabase/database.types'
// type Patient = Database['public']['Tables']['patients']['Row']

export type Clinic = Database['public']['Tables']['clinics']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Patient = Database['public']['Tables']['patients']['Row']
export type Dentist = Database['public']['Tables']['dentists']['Row']
export type Procedure = Database['public']['Tables']['procedures']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type KnowledgeBaseItem = Database['public']['Tables']['knowledge_base']['Row']
export type MessageTemplate = Database['public']['Tables']['message_templates']['Row']
export type Budget = Database['public']['Tables']['budgets']['Row']
export type BudgetItem = Database['public']['Tables']['budget_items']['Row']
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type CampaignRecipient = Database['public']['Tables']['campaign_recipients']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type WhatsAppInstance = Database['public']['Tables']['whatsapp_instances']['Row']
export type Waitlist = Database['public']['Tables']['waitlist']['Row']
export type PendingAction = Database['public']['Tables']['pending_actions']['Row']
export type DecisionLog = Database['public']['Tables']['decision_logs']['Row']
export type ConversationMemory = Database['public']['Tables']['conversation_memories']['Row']

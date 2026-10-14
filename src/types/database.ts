export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          description: string
          entity_id: string
          entity_type: Database['public']['Enums']['activity_entity']
          id: string
          metadata: Json | null
          org_id: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          description: string
          entity_id: string
          entity_type: Database['public']['Enums']['activity_entity']
          id?: string
          metadata?: Json | null
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          description?: string
          entity_id?: string
          entity_type?: Database['public']['Enums']['activity_entity']
          id?: string
          metadata?: Json | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_log_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      approval_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          evaluation_id: string
          id: string
          org_id: string
          recalled_at: string | null
          recalled_by: string | null
          rejection_reason:
            | Database['public']['Enums']['rejection_reason']
            | null
          rfp_id: string
          sla_due_at: string
          status: Database['public']['Enums']['approval_status']
          submitted_by: string
          submitted_to: string
          updated_at: string
          vendor_account_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          evaluation_id: string
          id?: string
          org_id: string
          recalled_at?: string | null
          recalled_by?: string | null
          rejection_reason?:
            | Database['public']['Enums']['rejection_reason']
            | null
          rfp_id: string
          sla_due_at: string
          status?: Database['public']['Enums']['approval_status']
          submitted_by: string
          submitted_to: string
          updated_at?: string
          vendor_account_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          evaluation_id?: string
          id?: string
          org_id?: string
          recalled_at?: string | null
          recalled_by?: string | null
          rejection_reason?:
            | Database['public']['Enums']['rejection_reason']
            | null
          rfp_id?: string
          sla_due_at?: string
          status?: Database['public']['Enums']['approval_status']
          submitted_by?: string
          submitted_to?: string
          updated_at?: string
          vendor_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'approval_requests_decided_by_fkey'
            columns: ['decided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'approval_requests_evaluation_id_fkey'
            columns: ['evaluation_id']
            isOneToOne: false
            referencedRelation: 'evaluations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'approval_requests_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'approval_requests_recalled_by_fkey'
            columns: ['recalled_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'approval_requests_rfp_id_fkey'
            columns: ['rfp_id']
            isOneToOne: false
            referencedRelation: 'rfps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'approval_requests_submitted_by_fkey'
            columns: ['submitted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'approval_requests_submitted_to_fkey'
            columns: ['submitted_to']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'approval_requests_vendor_account_id_fkey'
            columns: ['vendor_account_id']
            isOneToOne: false
            referencedRelation: 'vendor_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      compliance_flags: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          clause_text: string | null
          created_at: string
          document_id: string
          explanation: string
          flag_type: Database['public']['Enums']['flag_type']
          id: string
          org_id: string
          severity: Database['public']['Enums']['flag_severity']
          status: Database['public']['Enums']['flag_status']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          clause_text?: string | null
          created_at?: string
          document_id: string
          explanation: string
          flag_type: Database['public']['Enums']['flag_type']
          id?: string
          org_id: string
          severity: Database['public']['Enums']['flag_severity']
          status?: Database['public']['Enums']['flag_status']
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          clause_text?: string | null
          created_at?: string
          document_id?: string
          explanation?: string
          flag_type?: Database['public']['Enums']['flag_type']
          id?: string
          org_id?: string
          severity?: Database['public']['Enums']['flag_severity']
          status?: Database['public']['Enums']['flag_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'compliance_flags_acknowledged_by_fkey'
            columns: ['acknowledged_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'compliance_flags_document_id_fkey'
            columns: ['document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'compliance_flags_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      contracts: {
        Row: {
          alert_days: number
          approval_request_id: string
          created_at: string
          currency: string
          document_path: string | null
          end_date: string
          id: string
          is_deleted: boolean
          org_id: string
          payment_terms: string | null
          rfp_id: string
          search_vector: unknown
          start_date: string
          status: Database['public']['Enums']['contract_status']
          terminated_at: string | null
          terminated_by: string | null
          termination_reason: string | null
          title: string
          updated_at: string
          value: number | null
          vendor_account_id: string
        }
        ComputedFields: never
        Insert: {
          alert_days?: number
          approval_request_id: string
          created_at?: string
          currency?: string
          document_path?: string | null
          end_date: string
          id?: string
          is_deleted?: boolean
          org_id: string
          payment_terms?: string | null
          rfp_id: string
          search_vector?: never
          start_date: string
          status?: Database['public']['Enums']['contract_status']
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          title: string
          updated_at?: string
          value?: number | null
          vendor_account_id: string
        }
        Update: {
          alert_days?: number
          approval_request_id?: string
          created_at?: string
          currency?: string
          document_path?: string | null
          end_date?: string
          id?: string
          is_deleted?: boolean
          org_id?: string
          payment_terms?: string | null
          rfp_id?: string
          search_vector?: never
          start_date?: string
          status?: Database['public']['Enums']['contract_status']
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          title?: string
          updated_at?: string
          value?: number | null
          vendor_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contracts_approval_request_id_fkey'
            columns: ['approval_request_id']
            isOneToOne: false
            referencedRelation: 'approval_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_rfp_id_fkey'
            columns: ['rfp_id']
            isOneToOne: false
            referencedRelation: 'rfps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_terminated_by_fkey'
            columns: ['terminated_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'contracts_vendor_account_id_fkey'
            columns: ['vendor_account_id']
            isOneToOne: false
            referencedRelation: 'vendor_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          extracted_data_privacy: string | null
          extracted_delivery: string | null
          extracted_payment_terms: string | null
          extracted_pricing: string | null
          extracted_sla: string | null
          extracted_termination: string | null
          extracted_vendor_name: string | null
          extracted_warranty: string | null
          extraction_attempts: number
          extraction_error: string | null
          extraction_status: Database['public']['Enums']['extraction_status']
          file_name: string
          file_size_bytes: number
          file_type: Database['public']['Enums']['document_type']
          id: string
          last_extracted_at: string | null
          org_id: string
          raw_extraction: Json | null
          storage_path: string
          submission_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          extracted_data_privacy?: string | null
          extracted_delivery?: string | null
          extracted_payment_terms?: string | null
          extracted_pricing?: string | null
          extracted_sla?: string | null
          extracted_termination?: string | null
          extracted_vendor_name?: string | null
          extracted_warranty?: string | null
          extraction_attempts?: number
          extraction_error?: string | null
          extraction_status?: Database['public']['Enums']['extraction_status']
          file_name: string
          file_size_bytes: number
          file_type: Database['public']['Enums']['document_type']
          id?: string
          last_extracted_at?: string | null
          org_id: string
          raw_extraction?: Json | null
          storage_path: string
          submission_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extracted_data_privacy?: string | null
          extracted_delivery?: string | null
          extracted_payment_terms?: string | null
          extracted_pricing?: string | null
          extracted_sla?: string | null
          extracted_termination?: string | null
          extracted_vendor_name?: string | null
          extracted_warranty?: string | null
          extraction_attempts?: number
          extraction_error?: string | null
          extraction_status?: Database['public']['Enums']['extraction_status']
          file_name?: string
          file_size_bytes?: number
          file_type?: Database['public']['Enums']['document_type']
          id?: string
          last_extracted_at?: string | null
          org_id?: string
          raw_extraction?: Json | null
          storage_path?: string
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_submission_id_fkey'
            columns: ['submission_id']
            isOneToOne: false
            referencedRelation: 'submissions'
            referencedColumns: ['id']
          },
        ]
      }
      evaluation_criteria: {
        Row: {
          created_at: string
          description: string | null
          evaluation_id: string
          id: string
          is_ai_suggested: boolean
          name: string
          org_id: string
          sort_order: number
          updated_at: string
          weight: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          evaluation_id: string
          id?: string
          is_ai_suggested?: boolean
          name: string
          org_id: string
          sort_order?: number
          updated_at?: string
          weight: number
        }
        Update: {
          created_at?: string
          description?: string | null
          evaluation_id?: string
          id?: string
          is_ai_suggested?: boolean
          name?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: 'evaluation_criteria_evaluation_id_fkey'
            columns: ['evaluation_id']
            isOneToOne: false
            referencedRelation: 'evaluations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'evaluation_criteria_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          criteria_confirmed_at: string | null
          criteria_confirmed_by: string | null
          id: string
          last_scored_at: string | null
          org_id: string
          report_executive_summary: string | null
          report_generated_at: string | null
          report_recommendation: string | null
          rfp_id: string
          scoring_run_count: number
          status: Database['public']['Enums']['evaluation_status']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          criteria_confirmed_at?: string | null
          criteria_confirmed_by?: string | null
          id?: string
          last_scored_at?: string | null
          org_id: string
          report_executive_summary?: string | null
          report_generated_at?: string | null
          report_recommendation?: string | null
          rfp_id: string
          scoring_run_count?: number
          status?: Database['public']['Enums']['evaluation_status']
          updated_at?: string
        }
        Update: {
          created_at?: string
          criteria_confirmed_at?: string | null
          criteria_confirmed_by?: string | null
          id?: string
          last_scored_at?: string | null
          org_id?: string
          report_executive_summary?: string | null
          report_generated_at?: string | null
          report_recommendation?: string | null
          rfp_id?: string
          scoring_run_count?: number
          status?: Database['public']['Enums']['evaluation_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'evaluations_criteria_confirmed_by_fkey'
            columns: ['criteria_confirmed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'evaluations_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'evaluations_rfp_id_fkey'
            columns: ['rfp_id']
            isOneToOne: true
            referencedRelation: 'rfps'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          org_id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: Database['public']['Enums']['notification_type']
        }
        ComputedFields: never
        Insert: {
          body: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          org_id: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: Database['public']['Enums']['notification_type']
        }
        Update: {
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          org_id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: Database['public']['Enums']['notification_type']
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notifications_recipient_id_fkey'
            columns: ['recipient_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_deleted: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_deleted?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_deleted?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          onboarding_complete: boolean
          org_id: string
          role: Database['public']['Enums']['user_role']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          onboarding_complete?: boolean
          org_id: string
          role: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          onboarding_complete?: boolean
          org_id?: string
          role?: Database['public']['Enums']['user_role']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      requirements: {
        Row: {
          budget_estimate: number | null
          created_at: string
          department: string
          description: string
          id: string
          is_deleted: boolean
          linked_rfp_id: string | null
          org_id: string
          priority: Database['public']['Enums']['requirement_priority']
          raised_by: string
          required_by: string | null
          status: Database['public']['Enums']['requirement_status']
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          budget_estimate?: number | null
          created_at?: string
          department: string
          description: string
          id?: string
          is_deleted?: boolean
          linked_rfp_id?: string | null
          org_id: string
          priority?: Database['public']['Enums']['requirement_priority']
          raised_by: string
          required_by?: string | null
          status?: Database['public']['Enums']['requirement_status']
          title: string
          updated_at?: string
        }
        Update: {
          budget_estimate?: number | null
          created_at?: string
          department?: string
          description?: string
          id?: string
          is_deleted?: boolean
          linked_rfp_id?: string | null
          org_id?: string
          priority?: Database['public']['Enums']['requirement_priority']
          raised_by?: string
          required_by?: string | null
          status?: Database['public']['Enums']['requirement_status']
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'requirements_linked_rfp_id_fkey'
            columns: ['linked_rfp_id']
            isOneToOne: false
            referencedRelation: 'rfps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'requirements_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'requirements_raised_by_fkey'
            columns: ['raised_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      rfp_vendor_entries: {
        Row: {
          created_at: string
          id: string
          is_shortlisted: boolean
          org_id: string
          rfp_id: string
          status: Database['public']['Enums']['vendor_pipeline_status']
          updated_at: string
          vendor_account_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          is_shortlisted?: boolean
          org_id: string
          rfp_id: string
          status?: Database['public']['Enums']['vendor_pipeline_status']
          updated_at?: string
          vendor_account_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_shortlisted?: boolean
          org_id?: string
          rfp_id?: string
          status?: Database['public']['Enums']['vendor_pipeline_status']
          updated_at?: string
          vendor_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rfp_vendor_entries_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rfp_vendor_entries_rfp_id_fkey'
            columns: ['rfp_id']
            isOneToOne: false
            referencedRelation: 'rfps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rfp_vendor_entries_vendor_account_id_fkey'
            columns: ['vendor_account_id']
            isOneToOne: false
            referencedRelation: 'vendor_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      rfps: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          created_at: string
          created_by: string
          department: string
          description: string
          id: string
          is_deleted: boolean
          org_id: string
          requirement_id: string | null
          search_vector: unknown
          status: Database['public']['Enums']['rfp_status']
          submission_deadline: string | null
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          created_by: string
          department: string
          description: string
          id?: string
          is_deleted?: boolean
          org_id: string
          requirement_id?: string | null
          search_vector?: never
          status?: Database['public']['Enums']['rfp_status']
          submission_deadline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          created_by?: string
          department?: string
          description?: string
          id?: string
          is_deleted?: boolean
          org_id?: string
          requirement_id?: string | null
          search_vector?: never
          status?: Database['public']['Enums']['rfp_status']
          submission_deadline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rfps_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rfps_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rfps_requirement_id_fkey'
            columns: ['requirement_id']
            isOneToOne: false
            referencedRelation: 'requirements'
            referencedColumns: ['id']
          },
        ]
      }
      scoring_templates: {
        Row: {
          created_at: string
          created_by: string
          criteria: NonNullable<Json>
          id: string
          is_deleted: boolean
          last_used_at: string | null
          name: string
          org_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by: string
          criteria: NonNullable<Json>
          id?: string
          is_deleted?: boolean
          last_used_at?: string | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          criteria?: NonNullable<Json>
          id?: string
          is_deleted?: boolean
          last_used_at?: string | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'scoring_templates_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'scoring_templates_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          id: string
          org_id: string
          rfp_id: string
          rfp_vendor_entry_id: string
          status: Database['public']['Enums']['submission_status']
          submitted_at: string | null
          updated_at: string
          vendor_account_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          rfp_id: string
          rfp_vendor_entry_id: string
          status?: Database['public']['Enums']['submission_status']
          submitted_at?: string | null
          updated_at?: string
          vendor_account_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          rfp_id?: string
          rfp_vendor_entry_id?: string
          status?: Database['public']['Enums']['submission_status']
          submitted_at?: string | null
          updated_at?: string
          vendor_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'submissions_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'submissions_rfp_id_fkey'
            columns: ['rfp_id']
            isOneToOne: false
            referencedRelation: 'rfps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'submissions_rfp_vendor_entry_id_fkey'
            columns: ['rfp_vendor_entry_id']
            isOneToOne: false
            referencedRelation: 'rfp_vendor_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'submissions_vendor_account_id_fkey'
            columns: ['vendor_account_id']
            isOneToOne: false
            referencedRelation: 'vendor_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_accounts: {
        Row: {
          auth_user_id: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_deleted: boolean
          org_id: string
          search_vector: unknown
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          auth_user_id?: string | null
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          org_id: string
          search_vector?: never
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          org_id?: string
          search_vector?: never
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_accounts_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          personal_message: string | null
          rfp_id: string
          status: Database['public']['Enums']['invite_status']
          token: string
          vendor_account_id: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          invited_by: string
          org_id: string
          personal_message?: string | null
          rfp_id: string
          status?: Database['public']['Enums']['invite_status']
          token: string
          vendor_account_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          personal_message?: string | null
          rfp_id?: string
          status?: Database['public']['Enums']['invite_status']
          token?: string
          vendor_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_invites_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_invites_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_invites_rfp_id_fkey'
            columns: ['rfp_id']
            isOneToOne: false
            referencedRelation: 'rfps'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_invites_vendor_account_id_fkey'
            columns: ['vendor_account_id']
            isOneToOne: false
            referencedRelation: 'vendor_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      vendor_scores: {
        Row: {
          ai_reasoning: string | null
          ai_score: number | null
          ai_scored_at: string | null
          created_at: string
          criterion_id: string
          effective_score: number | null
          evaluation_id: string
          id: string
          org_id: string
          overridden_at: string | null
          overridden_by: string | null
          override_justification: string | null
          override_score: number | null
          scoring_run: number
          updated_at: string
          vendor_account_id: string
        }
        ComputedFields: never
        Insert: {
          ai_reasoning?: string | null
          ai_score?: number | null
          ai_scored_at?: string | null
          created_at?: string
          criterion_id: string
          effective_score?: never
          evaluation_id: string
          id?: string
          org_id: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_justification?: string | null
          override_score?: number | null
          scoring_run?: number
          updated_at?: string
          vendor_account_id: string
        }
        Update: {
          ai_reasoning?: string | null
          ai_score?: number | null
          ai_scored_at?: string | null
          created_at?: string
          criterion_id?: string
          effective_score?: never
          evaluation_id?: string
          id?: string
          org_id?: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_justification?: string | null
          override_score?: number | null
          scoring_run?: number
          updated_at?: string
          vendor_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_scores_criterion_id_fkey'
            columns: ['criterion_id']
            isOneToOne: false
            referencedRelation: 'evaluation_criteria'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_scores_evaluation_id_fkey'
            columns: ['evaluation_id']
            isOneToOne: false
            referencedRelation: 'evaluations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_scores_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organisations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_scores_overridden_by_fkey'
            columns: ['overridden_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_scores_vendor_account_id_fkey'
            columns: ['vendor_account_id']
            isOneToOne: false
            referencedRelation: 'vendor_accounts'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_document: { Args: { p_document_id: string }; Returns: boolean }
      can_read_evaluation: {
        Args: { p_evaluation_id: string }
        Returns: boolean
      }
      can_read_rfp: { Args: { p_rfp_id: string }; Returns: boolean }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      find_auth_user_by_email: {
        Args: { p_email: string }
        Returns: {
          app_metadata: Json
          created_at: string
          email_confirmed: boolean
          id: string
        }[]
      }
      get_org_id: { Args: Record<PropertyKey, never>; Returns: string }
      get_user_role: { Args: Record<PropertyKey, never>; Returns: string }
      get_user_type: { Args: Record<PropertyKey, never>; Returns: string }
      is_internal: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_pm: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_vendor: { Args: Record<PropertyKey, never>; Returns: boolean }
      my_vendor_account_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      process_contract_renewals: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reserve_invite_email: {
        Args: { p_actor_id: string; p_limit: number; p_org_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_entity:
        | 'organisation'
        | 'profile'
        | 'vendor_account'
        | 'requirement'
        | 'rfp'
        | 'rfp_vendor_entry'
        | 'submission'
        | 'document'
        | 'evaluation'
        | 'vendor_score'
        | 'compliance_flag'
        | 'approval_request'
        | 'contract'
        | 'scoring_template'
      approval_status: 'pending' | 'approved' | 'rejected' | 'recalled'
      contract_status: 'active' | 'expiring_soon' | 'expired' | 'terminated'
      document_type: 'pdf' | 'docx' | 'xlsx'
      evaluation_status:
        | 'not_started'
        | 'criteria_pending'
        | 'scoring_in_progress'
        | 'scored'
        | 'report_generated'
      extraction_status: 'queued' | 'processing' | 'extracted' | 'failed'
      flag_severity: 'high' | 'medium' | 'low'
      flag_status: 'open' | 'acknowledged' | 'escalated'
      flag_type:
        | 'payment_terms'
        | 'penalty_clause'
        | 'fee_structure'
        | 'price_escalation'
        | 'auto_renewal'
        | 'liability_limitation'
        | 'unilateral_modification'
        | 'jurisdiction'
        | 'ip_ownership'
        | 'data_breach_notification'
      invite_status: 'pending' | 'accepted' | 'expired'
      notification_type:
        | 'vendor_submitted'
        | 'scoring_complete'
        | 'extraction_failed'
        | 'approval_requested'
        | 'approval_sla_warning'
        | 'approval_decided'
        | 'renewal_alert'
        | 'vendor_status_updated'
        | 'requirement_submitted'
        | 'evaluation_ready'
      rejection_reason:
        | 'budget_concerns'
        | 'compliance_risk'
        | 'insufficient_information'
        | 'other'
      requirement_priority: 'low' | 'medium' | 'high' | 'critical'
      requirement_status:
        | 'draft'
        | 'submitted'
        | 'in_progress'
        | 'vendor_selected'
        | 'closed'
      rfp_status:
        | 'requirements_received'
        | 'rfp_created'
        | 'vendors_invited'
        | 'submissions_in'
        | 'under_evaluation'
        | 'shortlisted'
        | 'approval_pending'
        | 'contracted'
        | 'archived'
      submission_status: 'in_progress' | 'submitted' | 'under_review'
      user_role: 'procurement_manager' | 'department_head' | 'finance_approver'
      vendor_pipeline_status:
        | 'invited'
        | 'submitted'
        | 'under_review'
        | 'shortlisted'
        | 'approved'
        | 'not_selected'
        | 'contracted'
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
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
      activity_entity: [
        'organisation',
        'profile',
        'vendor_account',
        'requirement',
        'rfp',
        'rfp_vendor_entry',
        'submission',
        'document',
        'evaluation',
        'vendor_score',
        'compliance_flag',
        'approval_request',
        'contract',
        'scoring_template',
      ],
      approval_status: ['pending', 'approved', 'rejected', 'recalled'],
      contract_status: ['active', 'expiring_soon', 'expired', 'terminated'],
      document_type: ['pdf', 'docx', 'xlsx'],
      evaluation_status: [
        'not_started',
        'criteria_pending',
        'scoring_in_progress',
        'scored',
        'report_generated',
      ],
      extraction_status: ['queued', 'processing', 'extracted', 'failed'],
      flag_severity: ['high', 'medium', 'low'],
      flag_status: ['open', 'acknowledged', 'escalated'],
      flag_type: [
        'payment_terms',
        'penalty_clause',
        'fee_structure',
        'price_escalation',
        'auto_renewal',
        'liability_limitation',
        'unilateral_modification',
        'jurisdiction',
        'ip_ownership',
        'data_breach_notification',
      ],
      invite_status: ['pending', 'accepted', 'expired'],
      notification_type: [
        'vendor_submitted',
        'scoring_complete',
        'extraction_failed',
        'approval_requested',
        'approval_sla_warning',
        'approval_decided',
        'renewal_alert',
        'vendor_status_updated',
        'requirement_submitted',
        'evaluation_ready',
      ],
      rejection_reason: [
        'budget_concerns',
        'compliance_risk',
        'insufficient_information',
        'other',
      ],
      requirement_priority: ['low', 'medium', 'high', 'critical'],
      requirement_status: [
        'draft',
        'submitted',
        'in_progress',
        'vendor_selected',
        'closed',
      ],
      rfp_status: [
        'requirements_received',
        'rfp_created',
        'vendors_invited',
        'submissions_in',
        'under_evaluation',
        'shortlisted',
        'approval_pending',
        'contracted',
        'archived',
      ],
      submission_status: ['in_progress', 'submitted', 'under_review'],
      user_role: ['procurement_manager', 'department_head', 'finance_approver'],
      vendor_pipeline_status: [
        'invited',
        'submitted',
        'under_review',
        'shortlisted',
        'approved',
        'not_selected',
        'contracted',
      ],
    },
  },
} as const

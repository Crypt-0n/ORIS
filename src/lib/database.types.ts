export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'user'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'admin' | 'user'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'user'
          is_active?: boolean
          created_at?: string
        }
      }
      system_config: {
        Row: {
          key: string
          value: string
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
        }
        Update: {
          key?: string
          value?: string
          updated_at?: string
        }
      }
      severities: {
        Row: {
          id: string
          label: string
          color: string
          order: number
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          color: string
          order: number
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          color?: string
          order?: number
          created_at?: string
        }
      }
      task_results: {
        Row: {
          id: string
          label: string
          color: string
          order: number
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          color: string
          order: number
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          color?: string
          order?: number
          created_at?: string
        }
      }
      tlp_levels: {
        Row: {
          id: string
          code: string
          label: string
          description: string
          color: string
          order: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          label: string
          description: string
          color: string
          order: number
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          label?: string
          description?: string
          color?: string
          order?: number
          created_at?: string
        }
      }
      pap_levels: {
        Row: {
          id: string
          code: string
          label: string
          description: string
          color: string
          order: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          label: string
          description: string
          color: string
          order: number
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          label?: string
          description?: string
          color?: string
          order?: number
          created_at?: string
        }
      }
      cases: {
        Row: {
          id: string
          case_number: string
          title: string
          description: string
          author_id: string
          severity_id: string
          tlp_id: string
          pap_id: string
          status: 'open' | 'closed'
          closure_summary: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_number?: string
          title: string
          description: string
          author_id: string
          severity_id: string
          tlp_id?: string
          pap_id?: string
          status?: 'open' | 'closed'
          closure_summary?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_number?: string
          title?: string
          description?: string
          author_id?: string
          severity_id?: string
          tlp_id?: string
          pap_id?: string
          status?: 'open' | 'closed'
          closure_summary?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      case_assignments: {
        Row: {
          id: string
          case_id: string
          user_id: string
          assigned_at: string
        }
        Insert: {
          id?: string
          case_id: string
          user_id: string
          assigned_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          user_id?: string
          assigned_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          case_id: string
          title: string
          description: string
          result_id: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_id: string
          title: string
          description: string
          result_id?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          title?: string
          description?: string
          result_id?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          task_id: string
          author_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          author_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          author_id?: string
          content?: string
          created_at?: string
        }
      }
    }
  }
}

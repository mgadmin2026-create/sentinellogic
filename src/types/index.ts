// Zentrale TypeScript-Typen für Sentimental Logic

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'customer'
export type LeadSource = 'facebook' | 'tiktok' | 'manual' | 'klicktipp'

export type ActivityType = 'sync' | 'research' | 'ai_prep' | 'status_change'

export interface Lead {
  id: string
  created_at: string
  source: LeadSource
  first_name: string
  last_name: string
  email: string
  phone: string
  company_name?: string
  status: LeadStatus
  klicktipp_id?: string
  dialfire_id?: string
  research_data?: ResearchData
  notes?: string
}

export interface Customer {
  id: string
  lead_id: string
  created_at: string
  hidrive_folder_url?: string
  amisnow_id?: string
}

export interface Activity {
  id: string
  lead_id: string
  created_at: string
  type: ActivityType
  description: string
  data?: Record<string, unknown>
}

// Gewerbedaten vom Recherche-Bot
export interface ResearchData {
  company_name?: string
  industry?: string
  address?: string
  employee_count?: number
  founded_year?: number
  website?: string
  raw?: string
}

// Facebook Lead Ads Payload
export interface FacebookLeadPayload {
  object: string
  entry: FacebookLeadEntry[]
}

export interface FacebookLeadEntry {
  id: string
  time: number
  changes: FacebookLeadChange[]
}

export interface FacebookLeadChange {
  value: {
    leadgen_id: string
    page_id: string
    form_id: string
    ad_id: string
    ad_group_id: string
    created_time: number
    field_data?: FacebookFieldData[]
  }
  field: string
}

export interface FacebookFieldData {
  name: string
  values: string[]
}

// Klicktipp API Typen
export interface KlicktippContact {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  tags?: string[]
  fields?: Record<string, string>
}

export interface KlicktippSubscribeResponse {
  id?: string
  error?: string
}

// Dialfire API Typen
export interface DialfireContact {
  first_name: string
  last_name: string
  phone: string
  email?: string
  company?: string
  notes?: string
}

export interface DialfireCreateResponse {
  id?: string
  error?: string
}

// API Response Wrapper
export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

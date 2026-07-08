// Types mirroring placemate_schema.sql. Keep in sync with that file.

export type ApplicationStatus =
  | 'interested'
  | 'applied'
  | 'oa'
  | 'interview'
  | 'offer'
  | 'rejected'

export type ReminderKind = 'apply' | 'deadline' | 'daily_check'
export type ReminderRecurrence = 'none' | 'daily'
export type ReminderStatus = 'pending' | 'sent' | 'done' | 'snoozed'
export type MessageRole = 'user' | 'assistant'

export interface Profile {
  id: string
  full_name: string | null
  branch: string | null
  cgpa: number | null
  grad_year: number | null
  reminder_time: string | null // 'HH:MM:SS'
  timezone: string | null // IANA tz, e.g. 'Asia/Kolkata'
  created_at: string
}

export interface LinkItem {
  label: string
  url: string
}

export interface Application {
  id: string
  user_id: string
  company_name: string
  role: string | null
  ctc: string | null
  location: string | null
  mode: string | null
  deadline: string | null // 'YYYY-MM-DD'
  eligibility: string | null
  applied: boolean
  applied_date: string | null
  status: ApplicationStatus
  notes: string | null
  links: LinkItem[]
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Reminder {
  id: string
  user_id: string
  application_id: string | null
  kind: ReminderKind
  title: string
  due_at: string
  recurrence: ReminderRecurrence
  status: ReminderStatus
  snoozed_until: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  role: MessageRole
  content: string
  created_at: string
}

export interface CompanyDirectoryEntry {
  id: string
  company_name: string
  info: {
    rounds?: string
    difficulty?: string
    questions?: string
    tips?: string
  }
  contributed_by: string | null
  verified: boolean
  created_at: string
}

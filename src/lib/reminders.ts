import { supabase } from './supabase'
import type { Profile, Reminder } from './types'

export type ReminderInput = Pick<
  Reminder,
  'application_id' | 'kind' | 'title' | 'due_at' | 'recurrence'
>

export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle()
  if (error) throw error
  return (data as Profile) ?? null
}

export async function listReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('due_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Reminder[]
}

export async function createReminder(
  input: ReminderInput,
  userId: string,
): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .insert({ ...input, user_id: userId, status: 'pending' })
    .select()
    .single()
  if (error) throw error
  return data as Reminder
}

export async function updateReminder(
  id: string,
  patch: Partial<Reminder>,
): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Reminder
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) throw error
}

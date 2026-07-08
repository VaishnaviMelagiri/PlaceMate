import { supabase } from './supabase'
import type { Application, ApplicationStatus } from './types'

// Statuses that imply the user has actually applied. Moving a card into any of
// these auto-sets applied=true (and applied_date if blank). 'interested' and
// 'rejected' are intentionally excluded.
const IMPLIES_APPLIED: ApplicationStatus[] = ['applied', 'oa', 'interview', 'offer']

/**
 * Build the patch for a status change, applying the "applied" rule so the
 * board (drag + dropdown) and dashboard counts stay consistent.
 */
export function statusChangePatch(
  app: Application,
  status: ApplicationStatus,
): Partial<ApplicationInput> {
  const patch: Partial<ApplicationInput> = { status }
  if (IMPLIES_APPLIED.includes(status)) {
    patch.applied = true
    if (!app.applied_date) patch.applied_date = new Date().toISOString().slice(0, 10)
  }
  return patch
}

// Fields the user can edit. user_id is set from the session on insert; the DB
// fills id/created_at/updated_at.
export type ApplicationInput = Omit<
  Application,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>

export async function listApplications(): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Application[]
}

export async function createApplication(
  input: ApplicationInput,
  userId: string,
): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .insert({ ...input, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data as Application
}

export async function updateApplication(
  id: string,
  input: Partial<ApplicationInput>,
): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Application
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase.from('applications').delete().eq('id', id)
  if (error) throw error
}

import { supabase } from './supabase'
import type { CompanyDirectoryEntry } from './types'

export type DirectoryInfo = CompanyDirectoryEntry['info']

export interface DirectoryInput {
  company_name: string
  info: DirectoryInfo
}

export async function listDirectory(search = ''): Promise<CompanyDirectoryEntry[]> {
  let query = supabase
    .from('company_directory')
    .select('*')
    .order('verified', { ascending: false })
    .order('created_at', { ascending: false })
  const q = search.trim()
  if (q) query = query.ilike('company_name', `%${q}%`)
  const { data, error } = await query.limit(200)
  if (error) throw error
  return (data ?? []) as CompanyDirectoryEntry[]
}

export async function contributeDirectory(
  input: DirectoryInput,
  userId: string,
): Promise<CompanyDirectoryEntry> {
  const { data, error } = await supabase
    .from('company_directory')
    .insert({
      company_name: input.company_name,
      info: input.info,
      contributed_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data as CompanyDirectoryEntry
}

export async function updateDirectory(
  id: string,
  input: DirectoryInput,
): Promise<CompanyDirectoryEntry> {
  // RLS "directory - update own" restricts this to the contributor's own rows.
  const { data, error } = await supabase
    .from('company_directory')
    .update({ company_name: input.company_name, info: input.info })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CompanyDirectoryEntry
}

export async function deleteDirectory(id: string): Promise<void> {
  const { error } = await supabase.from('company_directory').delete().eq('id', id)
  if (error) throw error
}

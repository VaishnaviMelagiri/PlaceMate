import { supabase } from './supabase'
import type { ChatMessage } from './types'

export async function listChatMessages(limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ChatMessage[]
}

export interface ChatResponse {
  reply: string
  /** True when the reply is a graceful fallback (rate-limited / upstream error). */
  degraded?: boolean
}

/**
 * Send a message to the `chat` Edge Function. Only the message text is sent —
 * the user is identified server-side from their JWT, never a client-supplied id.
 */
export async function sendChat(message: string): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke<ChatResponse>('chat', {
    body: { message },
  })
  if (error) {
    // Network/edge error — surface a friendly, non-crashing fallback.
    return {
      reply: "I couldn't reach the assistant just now. Please try again in a moment.",
      degraded: true,
    }
  }
  return data ?? { reply: 'No response.', degraded: true }
}

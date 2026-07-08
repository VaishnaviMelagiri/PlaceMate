// subscribe-push — stores this browser's Web Push subscription for the
// authenticated user. Endpoint is unique; we upsert so re-subscribing on the
// same browser just refreshes the keys rather than duplicating rows.
//
// Deploy: supabase functions deploy subscribe-push
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface PushSubscriptionJSON {
  endpoint?: string
  keys?: { p256dh: string; auth: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    // A client bound to the caller's JWT so RLS applies and auth.uid() resolves.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) {
      return json({ error: 'Invalid session' }, 401)
    }

    const sub = (await req.json()) as PushSubscriptionJSON
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return json({ error: 'Invalid subscription payload' }, 400)
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      { onConflict: 'endpoint' },
    )
    if (error) throw error

    return json({ ok: true }, 200)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

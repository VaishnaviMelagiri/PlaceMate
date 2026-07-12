// send-due-reminders — invoked by pg_cron every 5 minutes (UTC).
//
// Finds due reminders, sends Web Push to each of the user's subscriptions,
// marks them sent, regenerates the next day's row for daily reminders, and
// prunes dead subscriptions (404/410). Uses the service-role key: it runs with
// no user context, so it must bypass RLS.
//
// Env (Edge Function secrets only — never in the frontend):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//   VAPID_SUBJECT (optional, e.g. 'mailto:you@example.com')
//
// Deploy: supabase functions deploy send-due-reminders
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

interface Reminder {
  id: string
  user_id: string
  application_id: string | null
  kind: string
  title: string
  due_at: string
  recurrence: 'none' | 'daily'
  status: string
  snoozed_until: string | null
}

interface PushSub {
  id: string
  user_id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') || 'mailto:placemate@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const nowIso = new Date().toISOString()

  // Due = pending & due_at passed, OR snoozed & snoozed_until passed.
  const { data: due, error } = await supabase
    .from('reminders')
    .select('*')
    .or(
      `and(status.eq.pending,due_at.lte.${nowIso}),and(status.eq.snoozed,snoozed_until.lte.${nowIso})`,
    )
  if (error) {
    return json({ error: error.message }, 500)
  }

  const reminders = (due ?? []) as Reminder[]
  if (reminders.length === 0) {
    return json({ processed: 0 }, 200)
  }

  // Fetch subscriptions for the affected users in one query.
  const userIds = [...new Set(reminders.map((r) => r.user_id))]
  const { data: subsData } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)
  const subsByUser = new Map<string, PushSub[]>()
  for (const s of (subsData ?? []) as PushSub[]) {
    const list = subsByUser.get(s.user_id) ?? []
    list.push(s)
    subsByUser.set(s.user_id, list)
  }

  // Optional email channel (feature-flagged by RESEND_API_KEY). We look up each
  // affected user's email once so every user gets reminders in their inbox too.
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const resendFrom = Deno.env.get('RESEND_FROM') || 'PlaceMate <onboarding@resend.dev>'
  const emailByUser = new Map<string, string | null>()
  if (resendKey) {
    for (const uid of userIds) {
      const { data } = await supabase.auth.admin.getUserById(uid)
      emailByUser.set(uid, data.user?.email ?? null)
    }
  }

  let sent = 0
  let skipped = 0
  let emailed = 0

  for (const r of reminders) {
    // --- Atomic claim: flip to 'sent' only if still due. If another concurrent
    // run already claimed it, `claimed` is empty and we skip — no double-fire. ---
    const { data: claimed } = await supabase
      .from('reminders')
      .update({ status: 'sent' })
      .eq('id', r.id)
      .in('status', ['pending', 'snoozed'])
      .select('id')
    if (!claimed || claimed.length === 0) {
      skipped++
      continue
    }

    // --- Regenerate the next daily occurrence (only the winner of the claim
    // reaches here, so exactly one next-day row is created). ---
    if (r.recurrence === 'daily') {
      const next = new Date(new Date(r.due_at).getTime() + 24 * 60 * 60 * 1000)
      await supabase.from('reminders').insert({
        user_id: r.user_id,
        application_id: r.application_id,
        kind: r.kind,
        title: r.title,
        due_at: next.toISOString(),
        recurrence: 'daily',
        status: 'pending',
      })
    }

    // --- Push to every subscription this user has. ---
    const subs = subsByUser.get(r.user_id) ?? []
    const payload = JSON.stringify({
      title: 'PlaceMate',
      body: r.title,
      reminderId: r.id,
      url: '/reminders',
    })

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
        )
        sent++
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        // 404/410 = subscription is gone; delete the dead row.
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error('web-push error', statusCode, (err as Error).message)
        }
      }
    }

    // --- Optional: email the same reminder to the user's inbox. ---
    if (resendKey) {
      const to = emailByUser.get(r.user_id)
      if (to) {
        try {
          await sendEmail(resendKey, resendFrom, to, r.title)
          emailed++
        } catch (e) {
          console.error('resend error', (e as Error).message)
        }
      }
    }
  }

  return json({ processed: reminders.length, sent, emailed, skipped }, 200)
})

// Send a reminder email via Resend (https://resend.com). Throws on non-2xx.
async function sendEmail(apiKey: string, from: string, to: string, title: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: `⏰ PlaceMate reminder: ${title}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
          <div style="background:#4f46e5;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0">
            <strong>🎯 PlaceMate reminder</strong>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 12px 12px">
            <p style="font-size:16px;margin:0 0 12px">${escapeHtml(title)}</p>
            <p style="color:#64748b;font-size:13px;margin:0">
              Open PlaceMate to update this application or snooze the reminder.
            </p>
          </div>
        </div>`,
    }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

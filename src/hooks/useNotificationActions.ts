import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getProfile, updateReminder } from '../lib/reminders'
import { DEFAULT_TZ, tomorrowAtUtcIso } from '../lib/time'

export type SnoozeFor = '10m' | '1h' | 'tomorrow'

async function snoozeReminder(id: string, by: SnoozeFor) {
  let snoozedUntil: string
  if (by === '10m') {
    snoozedUntil = new Date(Date.now() + 10 * 60_000).toISOString()
  } else if (by === '1h') {
    snoozedUntil = new Date(Date.now() + 60 * 60_000).toISOString()
  } else {
    // "tomorrow" = next day at the user's daily reminder time in their tz.
    const profile = await getProfile()
    const tz = profile?.timezone || DEFAULT_TZ
    const hhmm = (profile?.reminder_time ?? '09:00').slice(0, 5)
    snoozedUntil = tomorrowAtUtcIso(hhmm, tz)
  }
  // The dispatcher re-picks rows where status='snoozed' AND snoozed_until<=now().
  await updateReminder(id, { status: 'snoozed', snoozed_until: snoozedUntil })
}

/**
 * Handles snooze requests coming from the service worker's notification action
 * buttons. Two paths:
 *   1. If the app is already open, the SW postMessages { type:'snooze', ... }.
 *   2. If it had to open a window, we arrive with ?snooze=<id>&for=<by>.
 * The DB write runs here with the user's own credentials (RLS), so no elevated
 * key is needed in the service worker.
 */
export function useNotificationActions() {
  const [params, setParams] = useSearchParams()

  // Path 1: messages from the SW while the app is open.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; reminderId?: string; by?: SnoozeFor }
      if (data?.type === 'snooze' && data.reminderId && data.by) {
        void snoozeReminder(data.reminderId, data.by)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  // Path 2: cold-open via query params.
  useEffect(() => {
    const id = params.get('snooze')
    const by = params.get('for') as SnoozeFor | null
    if (id && by) {
      void snoozeReminder(id, by).finally(() => {
        // Clean the URL so a refresh doesn't re-snooze.
        params.delete('snooze')
        params.delete('for')
        setParams(params, { replace: true })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

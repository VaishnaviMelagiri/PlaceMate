/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

// Typed handle to the SW global. We avoid `declare const self` (which would
// clash with the lib's own `self` declaration) and just cast once.
const sw = self as unknown as ServiceWorkerGlobalScope

type WBManifest = Array<string | { url: string; revision: string | null }>

// --- Precache the static app shell -------------------------------------------
// The literal `self.__WB_MANIFEST` is the injection point Workbox replaces at
// build time. In `vite dev` it's NOT injected (undefined), so we fall back to an
// empty list — otherwise precacheAndRoute(undefined) throws and the whole SW
// fails to register (which kills push). No runtime caching is registered, so
// Supabase requests always hit the network and are never served stale.
const wbManifest =
  (self as unknown as { __WB_MANIFEST?: WBManifest }).__WB_MANIFEST ?? []
precacheAndRoute(wbManifest)
cleanupOutdatedCaches() // prunes only old precaches in Cache Storage; never localStorage

sw.skipWaiting()
clientsClaim()

// --- Push payload shape ------------------------------------------------------
interface PushPayload {
  title?: string
  body?: string
  reminderId?: string
  url?: string
}

// --- Push: show a notification with snooze actions ---------------------------
sw.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() }
  }

  const reminderId = payload.reminderId ?? ''
  event.waitUntil(
    sw.registration.showNotification(payload.title || 'PlaceMate reminder', {
      body: payload.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: reminderId || undefined, // collapse duplicate fires of the same reminder
      data: { reminderId, url: payload.url || '/' },
      // Snooze reschedules rather than dismissing.
      actions: [
        { action: 'snooze-10m', title: '💤 10 min' },
        { action: 'snooze-1h', title: '💤 1 hr' },
        { action: 'snooze-tomorrow', title: '💤 Tomorrow' },
      ],
    } as NotificationOptions),
  )
})

// --- Notification click: snooze or open the app ------------------------------
const SNOOZE_MAP: Record<string, '10m' | '1h' | 'tomorrow'> = {
  'snooze-10m': '10m',
  'snooze-1h': '1h',
  'snooze-tomorrow': 'tomorrow',
}

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const data = (event.notification.data ?? {}) as { reminderId?: string; url?: string }
  const reminderId = data.reminderId || ''
  const snoozeBy = SNOOZE_MAP[event.action]

  event.waitUntil(
    (async () => {
      const windows = await sw.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Snooze: the DB write must run with the user's own credentials (RLS),
      // which live in the page, not the SW. Hand it to an open client, or open
      // one carrying the intent in the URL.
      if (snoozeBy && reminderId) {
        const open = windows[0]
        if (open) {
          open.postMessage({ type: 'snooze', reminderId, by: snoozeBy })
          await open.focus()
        } else {
          await sw.clients.openWindow(`/?snooze=${reminderId}&for=${snoozeBy}`)
        }
        return
      }

      // Plain click: focus an existing window or open the target URL.
      const target = data.url || '/'
      if (windows[0]) {
        await windows[0].focus()
      } else {
        await sw.clients.openWindow(target)
      }
    })(),
  )
})

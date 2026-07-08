import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

/** VAPID public key (base64url) -> Uint8Array required by PushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  // Back it with a concrete ArrayBuffer so it's a valid BufferSource.
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return pushSupported ? Notification.permission : 'unsupported'
}

/**
 * Ask for permission, subscribe this browser to push, and persist the
 * subscription server-side via the `subscribe-push` Edge Function (which stores
 * it under the authenticated user). Idempotent — reuses an existing sub.
 */
export async function enablePush(): Promise<void> {
  if (!pushSupported) throw new Error('Push is not supported in this browser.')
  if (!VAPID_PUBLIC_KEY)
    throw new Error('VITE_VAPID_PUBLIC_KEY is not set — add it to your .env.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission denied.')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  // functions.invoke attaches the user's JWT automatically.
  const { error } = await supabase.functions.invoke('subscribe-push', {
    body: sub.toJSON(),
  })
  if (error) throw error
}

export async function disablePush(): Promise<void> {
  if (!pushSupported) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) await sub.unsubscribe()
}

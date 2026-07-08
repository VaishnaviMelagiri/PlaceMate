import { useState } from 'react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { Button } from './ui'

const DISMISS_KEY = 'placemate-install-dismissed'

/** Dismissible banner offering PWA install (Chromium) or an iOS manual hint. */
export default function InstallPrompt() {
  const { installed, canInstall, iosManual, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  if (installed || dismissed || (!canInstall && !iosManual)) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="border-b border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-600/10">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2 text-sm">
        <span className="text-lg">📲</span>
        <p className="flex-1 text-slate-700 dark:text-slate-200">
          {canInstall
            ? 'Install PlaceMate for quick access and reminders on your home screen.'
            : 'On iPhone: tap the Share button, then “Add to Home Screen” — needed for push notifications.'}
        </p>
        {canInstall && (
          <Button onClick={promptInstall} className="py-1.5">
            Install
          </Button>
        )}
        <button
          onClick={dismiss}
          className="rounded p-1 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

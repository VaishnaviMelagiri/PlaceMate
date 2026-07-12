import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import type { Application, Profile, Reminder } from '../lib/types'
import { listApplications } from '../lib/applications'
import {
  createReminder,
  deleteReminder,
  getProfile,
  listReminders,
  updateReminder,
  type ReminderInput,
} from '../lib/reminders'
import {
  DEFAULT_TZ,
  datetimeLocalToUtcIso,
  deadlineReminderUtcIso,
  formatInTz,
  isoToDatetimeLocal,
  nextDailyOccurrenceUtcIso,
} from '../lib/time'
import { enablePush, notificationPermission, pushSupported } from '../lib/push'
import { Button, Card, Field, FullScreenLoader, Modal, Select } from '../components/ui'

const KIND_LABEL: Record<Reminder['kind'], string> = {
  apply: 'Apply',
  deadline: 'Deadline',
  daily_check: 'Daily check',
}

export default function Reminders() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [apps, setApps] = useState<Application[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [perm, setPerm] = useState(notificationPermission())
  const [pushBusy, setPushBusy] = useState(false)

  // New one-off reminder form
  const [newKind, setNewKind] = useState<'apply' | 'deadline'>('apply')
  const [newAppId, setNewAppId] = useState('')
  const [newWhen, setNewWhen] = useState('')
  const [newDaysBefore, setNewDaysBefore] = useState('2')

  const [editing, setEditing] = useState<Reminder | null>(null)

  const tz = profile?.timezone || DEFAULT_TZ
  const reminderTime = (profile?.reminder_time ?? '09:00').slice(0, 5)

  async function refresh() {
    try {
      const [p, a, r] = await Promise.all([
        getProfile(),
        listApplications(),
        listReminders(),
      ])
      setProfile(p)
      setApps(a)
      setReminders(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const daily = useMemo(
    () => reminders.find((r) => r.kind === 'daily_check' && r.recurrence === 'daily'),
    [reminders],
  )

  async function handleEnablePush() {
    setPushBusy(true)
    setError(null)
    try {
      await enablePush()
      setPerm(notificationPermission())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  async function toggleDaily() {
    if (!user) return
    setError(null)
    try {
      if (daily) {
        await deleteReminder(daily.id)
        setReminders((r) => r.filter((x) => x.id !== daily.id))
      } else {
        const due = nextDailyOccurrenceUtcIso(reminderTime, tz)
        const created = await createReminder(
          {
            application_id: null,
            kind: 'daily_check',
            title: 'Check msrit.edu + Gmail',
            due_at: due,
            recurrence: 'daily',
          },
          user.id,
        )
        setReminders((r) => [...r, created])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update daily reminder.')
    }
  }

  async function addOneOff(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    const app = apps.find((a) => a.id === newAppId)
    if (!app) {
      setError('Pick an application.')
      return
    }
    try {
      let input: ReminderInput
      if (newKind === 'apply') {
        if (!newWhen) {
          setError('Choose a date & time.')
          return
        }
        input = {
          application_id: app.id,
          kind: 'apply',
          title: `Apply to ${app.company_name}`,
          due_at: datetimeLocalToUtcIso(newWhen, tz),
          recurrence: 'none',
        }
      } else {
        if (!app.deadline) {
          setError('That application has no deadline set.')
          return
        }
        const days = Math.max(0, Number(newDaysBefore) || 0)
        input = {
          application_id: app.id,
          kind: 'deadline',
          title: `${app.company_name} deadline in ${days}d`,
          due_at: deadlineReminderUtcIso(app.deadline, days, reminderTime, tz),
          recurrence: 'none',
        }
      }
      const created = await createReminder(input, user.id)
      setReminders((r) => [...r, created])
      setNewAppId('')
      setNewWhen('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reminder.')
    }
  }

  async function handleDelete(r: Reminder) {
    const prev = reminders
    setReminders((list) => list.filter((x) => x.id !== r.id))
    try {
      await deleteReminder(r.id)
    } catch (e) {
      setReminders(prev)
      setError(e instanceof Error ? e.message : 'Failed to delete.')
    }
  }

  async function saveEdit(title: string, whenLocal: string) {
    if (!editing) return
    const patch: Partial<Reminder> = {
      title,
      due_at: datetimeLocalToUtcIso(whenLocal, tz),
      status: 'pending',
      snoozed_until: null,
    }
    const updated = await updateReminder(editing.id, patch)
    setReminders((list) => list.map((x) => (x.id === updated.id ? updated : x)))
    setEditing(null)
  }

  if (loading) return <FullScreenLoader />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Reminders</h1>
        <p className="text-sm text-slate-500">
          Scheduled in your timezone ({tz}); delivered via push.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Notifications */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Push notifications</h2>
            <p className="text-sm text-slate-500">
              {!pushSupported
                ? 'Not supported in this browser.'
                : perm === 'granted'
                  ? 'Permission granted. If reminders don’t arrive, tap Re-subscribe.'
                  : perm === 'denied'
                    ? 'Blocked — enable notifications for this site in your browser settings.'
                    : 'Turn on to receive reminders even when the app is closed.'}
            </p>
          </div>
          {/* Always offer the action (unless blocked) so a failed/partial
              subscription can be retried — permission granted does NOT guarantee
              a saved push_subscriptions row. */}
          {pushSupported && perm !== 'denied' && (
            <Button onClick={handleEnablePush} disabled={pushBusy}>
              {pushBusy ? 'Enabling…' : perm === 'granted' ? 'Re-subscribe' : 'Enable'}
            </Button>
          )}
        </div>
      </Card>

      {/* Daily check */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Daily check reminder</h2>
            <p className="text-sm text-slate-500">
              “Check msrit.edu + Gmail” every day at {reminderTime}.{' '}
              {daily && (
                <span className="text-slate-400">
                  Next: {formatInTz(daily.snoozed_until ?? daily.due_at, tz)}
                </span>
              )}
            </p>
          </div>
          <Button variant={daily ? 'secondary' : 'primary'} onClick={toggleDaily}>
            {daily ? 'Turn off' : 'Turn on'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Change the time/timezone on your Profile, then toggle this off & on.
        </p>
      </Card>

      {/* Add one-off reminder */}
      <Card>
        <h2 className="mb-3 font-semibold">Add a reminder</h2>
        <form onSubmit={addOneOff} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Type"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as 'apply' | 'deadline')}
            >
              <option value="apply">Remind me to apply</option>
              <option value="deadline">Before a deadline</option>
            </Select>
            <Select
              label="Application"
              value={newAppId}
              onChange={(e) => setNewAppId(e.target.value)}
            >
              <option value="">Select…</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company_name}
                  {a.deadline ? ` (due ${a.deadline})` : ''}
                </option>
              ))}
            </Select>
          </div>
          {newKind === 'apply' ? (
            <Field
              label="When"
              type="datetime-local"
              value={newWhen}
              onChange={(e) => setNewWhen(e.target.value)}
            />
          ) : (
            <Field
              label="Days before deadline"
              type="number"
              min="0"
              value={newDaysBefore}
              onChange={(e) => setNewDaysBefore(e.target.value)}
              hint={`Fires at ${reminderTime} local, that many days before the deadline.`}
            />
          )}
          <div>
            <Button type="submit">Add reminder</Button>
          </div>
        </form>
      </Card>

      {/* List */}
      <Card className="overflow-x-auto p-0">
        {reminders.length === 0 ? (
          <p className="p-5 text-center text-sm text-slate-500">No reminders yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Reminder</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Next fire</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-slate-500">{KIND_LABEL[r.kind]}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatInTz(r.snoozed_until ?? r.due_at, tz)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.recurrence === 'none' && (
                      <button
                        onClick={() => setEditing(r)}
                        className="rounded px-2 py-1 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/20"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r)}
                      className="rounded px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <EditReminderModal
          reminder={editing}
          tz={tz}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  )
}

function EditReminderModal({
  reminder,
  tz,
  onClose,
  onSave,
}: {
  reminder: Reminder
  tz: string
  onClose: () => void
  onSave: (title: string, whenLocal: string) => Promise<void>
}) {
  const [title, setTitle] = useState(reminder.title)
  const [when, setWhen] = useState(isoToDatetimeLocal(reminder.due_at, tz))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await onSave(title, when)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save.')
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit reminder">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field
          label="When"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

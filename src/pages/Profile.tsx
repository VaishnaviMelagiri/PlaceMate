import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthProvider'
import type { Profile as ProfileRow } from '../lib/types'
import { DEFAULT_TZ } from '../lib/time'
import { Button, Card, Field, FullScreenLoader, Select } from '../components/ui'

// A short, sensible IANA timezone list; the user's detected zone is always
// included so the dropdown is never empty of the right option.
const COMMON_TZS = Array.from(
  new Set([
    DEFAULT_TZ,
    'Asia/Kolkata',
    'Asia/Dubai',
    'Asia/Singapore',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
    'UTC',
  ]),
)

// The DB stores reminder_time as 'HH:MM:SS'; the <input type=time> wants 'HH:MM'.
const toTimeInput = (t: string | null) => (t ? t.slice(0, 5) : '09:00')

export default function Profile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [branch, setBranch] = useState('')
  const [cgpa, setCgpa] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [timezone, setTimezone] = useState(DEFAULT_TZ)

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return
      if (error) {
        setError(error.message)
      } else if (data) {
        const p = data as ProfileRow
        setFullName(p.full_name ?? '')
        setBranch(p.branch ?? '')
        setCgpa(p.cgpa != null ? String(p.cgpa) : '')
        setGradYear(p.grad_year != null ? String(p.grad_year) : '')
        setReminderTime(toTimeInput(p.reminder_time))
        setTimezone(p.timezone || DEFAULT_TZ)
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const payload = {
      id: user.id,
      full_name: fullName.trim() || null,
      branch: branch.trim() || null,
      cgpa: cgpa ? Number(cgpa) : null,
      grad_year: gradYear ? Number(gradYear) : null,
      reminder_time: `${reminderTime}:00`,
      timezone,
    }

    // upsert covers both the trigger-created row and any edge case where it's missing.
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  if (loading) return <FullScreenLoader />

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Profile</h1>
      <p className="mb-6 text-sm text-slate-500">
        Used to personalise prep advice and to time your daily reminder.
      </p>

      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Field
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ada Lovelace"
          />
          <Field
            label="Branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="CSE / ISE / ECE …"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="CGPA"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={cgpa}
              onChange={(e) => setCgpa(e.target.value)}
              placeholder="8.50"
            />
            <Field
              label="Graduation year"
              type="number"
              min="2000"
              max="2100"
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              placeholder="2026"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Daily reminder time"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              hint="When to check msrit.edu + Gmail."
            />
            <Select
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {COMMON_TZS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </div>
          <p className="-mt-1 text-xs text-slate-500">
            Reminders are scheduled in your timezone, then stored in UTC.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </Button>
            {saved && <span className="text-sm text-green-600">Saved ✓</span>}
          </div>
        </form>
      </Card>
    </div>
  )
}

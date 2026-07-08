import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import type { Application, ApplicationStatus } from '../lib/types'
import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
  type ApplicationInput,
} from '../lib/applications'
import { STATUS_META, STATUS_ORDER } from '../lib/status'
import { downloadApplicationsCsv } from '../lib/csv'
import ApplicationForm from '../components/ApplicationForm'
import { Button, Card, FullScreenLoader } from '../components/ui'

type AppliedFilter = 'all' | 'applied' | 'not_applied'
type SortBy = 'deadline' | 'recent'

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
      {meta.label}
    </span>
  )
}

function formatDeadline(d: string | null) {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86400000)
  const label = date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (days < 0) return { text: label, note: `${-days}d ago`, tone: 'text-slate-400' }
  if (days === 0) return { text: label, note: 'today', tone: 'text-red-600 font-medium' }
  if (days <= 2) return { text: label, note: `in ${days}d`, tone: 'text-red-600 font-medium' }
  if (days <= 7) return { text: label, note: `in ${days}d`, tone: 'text-amber-600' }
  return { text: label, note: `in ${days}d`, tone: 'text-slate-500' }
}

export default function Applications() {
  const { user } = useAuth()
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('deadline')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Application | undefined>(undefined)

  async function refresh() {
    try {
      setApps(await listApplications())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = apps.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (appliedFilter === 'applied' && !a.applied) return false
      if (appliedFilter === 'not_applied' && a.applied) return false
      if (q) {
        const hay = `${a.company_name} ${a.role ?? ''} ${a.location ?? ''} ${a.tags.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    list.sort((a, b) => {
      if (sortBy === 'recent') {
        return b.created_at.localeCompare(a.created_at)
      }
      // Deadline soonest first; nulls sink to the bottom.
      if (!a.deadline && !b.deadline) return 0
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline.localeCompare(b.deadline)
    })
    return list
  }, [apps, search, statusFilter, appliedFilter, sortBy])

  async function handleSubmit(input: ApplicationInput) {
    if (!user) return
    if (editing) {
      const updated = await updateApplication(editing.id, input)
      setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } else {
      const created = await createApplication(input, user.id)
      setApps((prev) => [created, ...prev])
    }
  }

  async function handleDelete(app: Application) {
    if (!window.confirm(`Delete "${app.company_name}"? This can't be undone.`)) return
    // Optimistic remove; restore on failure.
    const prev = apps
    setApps((p) => p.filter((a) => a.id !== app.id))
    try {
      await deleteApplication(app.id)
    } catch (err) {
      setApps(prev)
      setError(err instanceof Error ? err.message : 'Failed to delete.')
    }
  }

  function openAdd() {
    setEditing(undefined)
    setFormOpen(true)
  }
  function openEdit(app: Application) {
    setEditing(app)
    setFormOpen(true)
  }

  if (loading) return <FullScreenLoader />

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-sm text-slate-500">
            {apps.length} total · {apps.filter((a) => a.applied).length} applied
          </p>
        </div>
        <div className="flex items-center gap-2">
          {apps.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => downloadApplicationsCsv(filtered)}
              title="Export the current (filtered) list as CSV"
            >
              ⬇ Export CSV
            </Button>
          )}
          <Button onClick={openAdd}>+ Add application</Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Search company, role, location, tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'all')}
        >
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={appliedFilter}
          onChange={(e) => setAppliedFilter(e.target.value as AppliedFilter)}
        >
          <option value="all">Applied: any</option>
          <option value="applied">Applied</option>
          <option value="not_applied">Not applied</option>
        </select>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="deadline">Sort: deadline</option>
          <option value="recent">Sort: recently added</option>
        </select>
      </div>

      {apps.length === 0 ? (
        <Card className="text-center">
          <p className="text-slate-600 dark:text-slate-300">
            No applications yet. Add the first company you're eyeing.
          </p>
          <div className="mt-4">
            <Button onClick={openAdd}>+ Add application</Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center text-slate-500">
          No applications match your filters.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => {
                const dl = formatDeadline(app.deadline)
                return (
                  <tr
                    key={app.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{app.company_name}</div>
                      <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                        {app.location && <span>{app.location}</span>}
                        {app.ctc && <span>· {app.ctc}</span>}
                        {app.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500 dark:bg-slate-800"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {app.role || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3">
                      {typeof dl === 'string' ? (
                        <span className="text-slate-400">{dl}</span>
                      ) : (
                        <span className={dl.tone}>
                          {dl.text} <span className="text-xs">· {dl.note}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {app.applied ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(app)}
                        className="rounded px-2 py-1 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(app)}
                        className="rounded px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Mount only while open (with a key) so the form's internal state is
          freshly initialised for each Add/Edit rather than reused. */}
      {formOpen && (
        <ApplicationForm
          key={editing?.id ?? 'new'}
          open
          onClose={() => setFormOpen(false)}
          initial={editing}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}

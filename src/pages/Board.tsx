import { useEffect, useState } from 'react'
import type { Application, ApplicationStatus } from '../lib/types'
import { listApplications, statusChangePatch, updateApplication } from '../lib/applications'
import { STATUS_META, STATUS_ORDER } from '../lib/status'
import { Card, FullScreenLoader } from '../components/ui'

export default function Board() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ApplicationStatus | null>(null)

  useEffect(() => {
    listApplications()
      .then(setApps)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setLoading(false))
  }, [])

  async function moveTo(app: Application, status: ApplicationStatus) {
    if (app.status === status) return
    const prev = apps
    // Shared rule: moving past "interested" marks it applied (+ applied_date).
    const patch = statusChangePatch(app, status)
    // Optimistic: reflect the move immediately, roll back if the write fails.
    setApps((list) => list.map((a) => (a.id === app.id ? { ...a, ...patch } : a)))
    try {
      await updateApplication(app.id, patch)
    } catch (e) {
      setApps(prev)
      setError(e instanceof Error ? e.message : 'Failed to move card.')
    }
  }

  function onDrop(status: ApplicationStatus) {
    const app = apps.find((a) => a.id === dragId)
    setDragId(null)
    setOverCol(null)
    if (app) moveTo(app, status)
  }

  if (loading) return <FullScreenLoader />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Board</h1>
        <p className="text-sm text-slate-500">
          Drag a card between columns to update its status.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {apps.length === 0 ? (
        <Card className="text-center text-slate-500">
          No applications yet — add some from the Applications tab.
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_ORDER.map((status) => {
            const colApps = apps.filter((a) => a.status === status)
            const meta = STATUS_META[status]
            return (
              <div
                key={status}
                className={`flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50 dark:bg-slate-900/50 ${
                  overCol === status
                    ? 'border-brand-500 ring-2 ring-brand-500/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverCol(status)
                }}
                onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
                onDrop={() => onDrop(status)}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-slate-400">{colApps.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                  {colApps.map((app) => (
                    <article
                      key={app.id}
                      draggable
                      onDragStart={() => setDragId(app.id)}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverCol(null)
                      }}
                      className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 ${
                        dragId === app.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="font-medium">{app.company_name}</div>
                      {app.role && (
                        <div className="text-xs text-slate-500">{app.role}</div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-400">
                        {app.deadline && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
                            📅{' '}
                            {new Date(app.deadline + 'T00:00:00').toLocaleDateString(
                              undefined,
                              { day: 'numeric', month: 'short' },
                            )}
                          </span>
                        )}
                        {app.applied && <span className="text-green-600">✓ applied</span>}
                      </div>
                      {/* Touch-friendly inline move: one tap, no drag. Stop the
                          drag handlers from hijacking the select on mobile. */}
                      <select
                        aria-label={`Move ${app.company_name} to status`}
                        value={app.status}
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          moveTo(app, e.target.value as ApplicationStatus)
                        }
                        className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            Move to: {STATUS_META[s].label}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                  {colApps.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

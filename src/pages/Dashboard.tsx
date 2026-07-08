import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Application } from '../lib/types'
import { listApplications } from '../lib/applications'
import { STATUS_META } from '../lib/status'
import { Card, FullScreenLoader } from '../components/ui'

const APPLY_SOON_DAYS = 7

function daysUntil(deadline: string) {
  const d = new Date(deadline + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function StatTile({
  label,
  value,
  tone = 'text-slate-900 dark:text-slate-100',
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className={`text-3xl font-bold ${tone}`}>{value}</span>
      <span className="text-sm text-slate-500">{label}</span>
    </Card>
  )
}

export default function Dashboard() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listApplications()
      .then(setApps)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const byStatus = (s: Application['status']) =>
      apps.filter((a) => a.status === s).length

    // Upcoming: future-dated deadlines, soonest first.
    const upcoming = apps
      .filter((a) => a.deadline && daysUntil(a.deadline) >= 0)
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
      .slice(0, 6)

    // Apply-soon: not yet applied, deadline within the window (incl. overdue).
    const applySoon = apps
      .filter(
        (a) => !a.applied && a.deadline && daysUntil(a.deadline) <= APPLY_SOON_DAYS,
      )
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!))

    const open = apps.filter((a) => a.status !== 'rejected').length
    const appliedCount = apps.filter((a) => a.applied).length
    const progress = open > 0 ? Math.round((appliedCount / open) * 100) : 0

    return {
      total: apps.length,
      interested: byStatus('interested'),
      applied: appliedCount,
      offers: byStatus('offer'),
      interviews: byStatus('interview'),
      upcoming,
      applySoon,
      open,
      progress,
    }
  }, [apps])

  if (loading) return <FullScreenLoader />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">Your placement season at a glance.</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {apps.length === 0 ? (
        <Card className="text-center">
          <p className="text-slate-600 dark:text-slate-300">
            Nothing tracked yet. Start by adding companies you're interested in.
          </p>
          <Link
            to="/applications"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Add your first application
          </Link>
        </Card>
      ) : (
        <>
          {/* Counts */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Interested" value={stats.interested} />
            <StatTile label="Applied" value={stats.applied} tone="text-blue-600" />
            <StatTile
              label="Interviews"
              value={stats.interviews}
              tone="text-amber-600"
            />
            <StatTile label="Offers" value={stats.offers} tone="text-green-600" />
          </div>

          {/* Progress */}
          <Card>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Application progress</span>
              <span className="text-slate-500">
                Applied to {stats.applied}/{stats.open} open
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Apply soon */}
            <Card>
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                ⏰ Apply soon
                <span className="text-xs font-normal text-slate-400">
                  (not applied, ≤ {APPLY_SOON_DAYS} days)
                </span>
              </h2>
              {stats.applySoon.length === 0 ? (
                <p className="text-sm text-slate-500">
                  You're on top of things — nothing urgent.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.applySoon.map((a) => {
                    const d = daysUntil(a.deadline!)
                    return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
                      >
                        <span className="font-medium">{a.company_name}</span>
                        <span
                          className={
                            d < 0
                              ? 'text-slate-400'
                              : d <= 2
                                ? 'font-medium text-red-600'
                                : 'text-amber-600'
                          }
                        >
                          {d < 0 ? `${-d}d overdue` : d === 0 ? 'today' : `in ${d}d`}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            {/* Upcoming deadlines */}
            <Card>
              <h2 className="mb-3 font-semibold">📅 Upcoming deadlines</h2>
              {stats.upcoming.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming deadlines.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.upcoming.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{a.company_name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${STATUS_META[a.status].badge}`}
                        >
                          {STATUS_META[a.status].label}
                        </span>
                      </span>
                      <span className="text-slate-500">
                        {new Date(a.deadline! + 'T00:00:00').toLocaleDateString(
                          undefined,
                          { day: 'numeric', month: 'short' },
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

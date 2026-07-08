import type { Application } from './types'

const COLUMNS: { header: string; get: (a: Application) => string }[] = [
  { header: 'Company', get: (a) => a.company_name },
  { header: 'Role', get: (a) => a.role ?? '' },
  { header: 'CTC', get: (a) => a.ctc ?? '' },
  { header: 'Location', get: (a) => a.location ?? '' },
  { header: 'Mode', get: (a) => a.mode ?? '' },
  { header: 'Status', get: (a) => a.status },
  { header: 'Deadline', get: (a) => a.deadline ?? '' },
  { header: 'Applied', get: (a) => (a.applied ? 'yes' : 'no') },
  { header: 'Applied date', get: (a) => a.applied_date ?? '' },
  { header: 'Eligibility', get: (a) => a.eligibility ?? '' },
  { header: 'Tags', get: (a) => a.tags.join('; ') },
  { header: 'Notes', get: (a) => a.notes ?? '' },
  {
    header: 'Links',
    get: (a) => a.links.map((l) => `${l.label}: ${l.url}`).join('; '),
  },
]

/** RFC-4180-ish escaping: wrap in quotes and double any inner quotes. */
function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function applicationsToCsv(apps: Application[]): string {
  const rows = [
    COLUMNS.map((c) => c.header),
    ...apps.map((a) => COLUMNS.map((c) => escapeCell(c.get(a)))),
  ]
  return rows.map((r) => r.join(',')).join('\r\n')
}

/** Trigger a client-side download of the applications as a CSV file. */
export function downloadApplicationsCsv(apps: Application[]) {
  // Prepend a BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(['﻿' + applicationsToCsv(apps)], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `placemate-applications-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

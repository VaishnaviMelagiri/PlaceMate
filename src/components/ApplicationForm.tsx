import { useState } from 'react'
import type { Application, ApplicationStatus, LinkItem } from '../lib/types'
import type { ApplicationInput } from '../lib/applications'
import { STATUS_META, STATUS_ORDER } from '../lib/status'
import { Button, Field, Modal, Select, TextArea } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  /** Existing application when editing; undefined when creating. */
  initial?: Application
  onSubmit: (input: ApplicationInput) => Promise<void>
}

const emptyState: ApplicationInput = {
  company_name: '',
  role: '',
  ctc: '',
  location: '',
  mode: '',
  deadline: null,
  eligibility: '',
  applied: false,
  applied_date: null,
  status: 'interested',
  notes: '',
  links: [],
  tags: [],
}

function fromApplication(a: Application): ApplicationInput {
  return {
    company_name: a.company_name,
    role: a.role ?? '',
    ctc: a.ctc ?? '',
    location: a.location ?? '',
    mode: a.mode ?? '',
    deadline: a.deadline,
    eligibility: a.eligibility ?? '',
    applied: a.applied,
    applied_date: a.applied_date,
    status: a.status,
    notes: a.notes ?? '',
    links: a.links ?? [],
    tags: a.tags ?? [],
  }
}

export default function ApplicationForm({ open, onClose, initial, onSubmit }: Props) {
  const [form, setForm] = useState<ApplicationInput>(
    initial ? fromApplication(initial) : emptyState,
  )
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ApplicationInput>(key: K, value: ApplicationInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updateLink(i: number, patch: Partial<LinkItem>) {
    setForm((f) => ({
      ...f,
      links: f.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }))
  }
  function addLink() {
    setForm((f) => ({ ...f, links: [...f.links, { label: '', url: '' }] }))
  }
  function removeLink(i: number) {
    setForm((f) => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.company_name.trim()) {
      setError('Company name is required.')
      return
    }
    setBusy(true)
    try {
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const links = form.links.filter((l) => l.label.trim() || l.url.trim())
      // Auto-set applied_date when marking applied and none was given.
      const applied_date =
        form.applied && !form.applied_date
          ? new Date().toISOString().slice(0, 10)
          : form.applied
            ? form.applied_date
            : null
      await onSubmit({
        ...form,
        company_name: form.company_name.trim(),
        deadline: form.deadline || null,
        applied_date,
        tags,
        links,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit application' : 'Add application'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Company name *"
          value={form.company_name}
          onChange={(e) => set('company_name', e.target.value)}
          placeholder="Acme Corp"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Role"
            value={form.role ?? ''}
            onChange={(e) => set('role', e.target.value)}
            placeholder="SDE Intern"
          />
          <Field
            label="CTC / stipend"
            value={form.ctc ?? ''}
            onChange={(e) => set('ctc', e.target.value)}
            placeholder="12 LPA / 45k"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Location"
            value={form.location ?? ''}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Bengaluru"
          />
          <Select
            label="Mode"
            value={form.mode ?? ''}
            onChange={(e) => set('mode', e.target.value)}
          >
            <option value="">—</option>
            <option value="on-campus">On-campus</option>
            <option value="off-campus">Off-campus</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as ApplicationStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
          <Field
            label="Deadline"
            type="date"
            value={form.deadline ?? ''}
            onChange={(e) => set('deadline', e.target.value || null)}
          />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={form.applied}
              onChange={(e) => set('applied', e.target.checked)}
            />
            Applied?
          </label>
          {form.applied && (
            <div className="flex-1">
              <Field
                label="Applied date"
                type="date"
                value={form.applied_date ?? ''}
                onChange={(e) => set('applied_date', e.target.value || null)}
              />
            </div>
          )}
        </div>

        <TextArea
          label="Eligibility"
          rows={2}
          value={form.eligibility ?? ''}
          onChange={(e) => set('eligibility', e.target.value)}
          placeholder="CGPA ≥ 7, no active backlogs, CSE/ISE/ECE"
        />
        <TextArea
          label="Notes"
          rows={3}
          value={form.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Referral from senior; OA on HackerRank…"
        />
        <Field
          label="Tags"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="dream, product, backup"
          hint="Comma-separated."
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Links
            </span>
            <Button type="button" variant="ghost" onClick={addLink}>
              + Add link
            </Button>
          </div>
          {form.links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Label (JD)"
                value={link.label}
                onChange={(e) => updateLink(i, { label: e.target.value })}
              />
              <input
                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="https://…"
                value={link.url}
                onChange={(e) => updateLink(i, { url: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                aria-label="Remove link"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add application'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

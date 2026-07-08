import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthProvider'
import type { CompanyDirectoryEntry } from '../lib/types'
import {
  contributeDirectory,
  deleteDirectory,
  listDirectory,
  updateDirectory,
  type DirectoryInput,
} from '../lib/directory'
import { Button, Card, Field, FullScreenLoader, Modal, TextArea } from '../components/ui'

export default function Directory() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<CompanyDirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyDirectoryEntry | undefined>()

  async function refresh(q = search) {
    try {
      setEntries(await listDirectory(q))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load directory.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => refresh(search), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function handleSubmit(input: DirectoryInput) {
    if (!user) return
    if (editing) {
      const updated = await updateDirectory(editing.id, input)
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    } else {
      const created = await contributeDirectory(input, user.id)
      setEntries((prev) => [created, ...prev])
    }
  }

  async function handleDelete(entry: CompanyDirectoryEntry) {
    if (!window.confirm(`Delete your entry for "${entry.company_name}"?`)) return
    const prev = entries
    setEntries((list) => list.filter((e) => e.id !== entry.id))
    try {
      await deleteDirectory(entry.id)
    } catch (e) {
      setEntries(prev)
      setError(e instanceof Error ? e.message : 'Failed to delete.')
    }
  }

  if (loading) return <FullScreenLoader />

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Company Directory</h1>
          <p className="text-sm text-slate-500">
            Crowdsourced rounds, difficulty & tips. Shared by everyone — and fed
            to the prep assistant.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setFormOpen(true)
          }}
        >
          + Contribute
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <input
        className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        placeholder="Search companies…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {entries.length === 0 ? (
        <Card className="text-center text-slate-500">
          {search
            ? 'No companies match your search.'
            : 'Nothing here yet — be the first to contribute a company.'}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{entry.company_name}</h2>
                {entry.verified && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    ✓ Verified
                  </span>
                )}
              </div>

              <dl className="flex flex-col gap-1.5 text-sm">
                <InfoRow label="Rounds" value={entry.info?.rounds} />
                <InfoRow label="Difficulty" value={entry.info?.difficulty} />
                <InfoRow label="Questions" value={entry.info?.questions} />
                <InfoRow label="Tips" value={entry.info?.tips} />
              </dl>

              {entry.contributed_by === user?.id && (
                <div className="mt-1 flex gap-2 border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
                  <button
                    onClick={() => {
                      setEditing(entry)
                      setFormOpen(true)
                    }}
                    className="rounded px-2 py-1 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/20"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    className="rounded px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <ContributeForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  )
}

function ContributeForm({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: CompanyDirectoryEntry
  onClose: () => void
  onSubmit: (input: DirectoryInput) => Promise<void>
}) {
  const [company, setCompany] = useState(initial?.company_name ?? '')
  const [rounds, setRounds] = useState(initial?.info?.rounds ?? '')
  const [difficulty, setDifficulty] = useState(initial?.info?.difficulty ?? '')
  const [questions, setQuestions] = useState(initial?.info?.questions ?? '')
  const [tips, setTips] = useState(initial?.info?.tips ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!company.trim()) {
      setErr('Company name is required.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await onSubmit({
        company_name: company.trim(),
        info: {
          rounds: rounds.trim() || undefined,
          difficulty: difficulty.trim() || undefined,
          questions: questions.trim() || undefined,
          tips: tips.trim() || undefined,
        },
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.')
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={initial ? 'Edit contribution' : 'Contribute company info'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Company name *"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Corp"
          autoFocus
        />
        <TextArea
          label="Rounds"
          rows={2}
          value={rounds}
          onChange={(e) => setRounds(e.target.value)}
          placeholder="OA → 2 technical → HR"
        />
        <Field
          label="Difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          placeholder="Medium"
        />
        <TextArea
          label="Questions asked"
          rows={3}
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          placeholder="DP on strings, LRU cache, SQL joins…"
        />
        <TextArea
          label="Tips"
          rows={2}
          value={tips}
          onChange={(e) => setTips(e.target.value)}
          placeholder="Revise OS + DBMS; they focus on projects in HR."
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Contribute'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

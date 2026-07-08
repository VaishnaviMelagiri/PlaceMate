import type { ApplicationStatus } from './types'

/** Ordered pipeline used by the list, board (Phase 4) and forms. */
export const STATUS_ORDER: ApplicationStatus[] = [
  'interested',
  'applied',
  'oa',
  'interview',
  'offer',
  'rejected',
]

export const STATUS_META: Record<
  ApplicationStatus,
  { label: string; badge: string }
> = {
  interested: {
    label: 'Interested',
    badge:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  applied: {
    label: 'Applied',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  oa: {
    label: 'OA',
    badge:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
  interview: {
    label: 'Interview',
    badge:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  offer: {
    label: 'Offer',
    badge:
      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  rejected: {
    label: 'Rejected',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
}

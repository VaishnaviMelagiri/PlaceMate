// Timezone-aware conversion helpers.
//
// The DB stores reminder due_at as a real UTC timestamptz. pg_cron and the Edge
// Function run in UTC, so we must convert the user's *local wall-clock* time in
// *their* timezone into an absolute UTC instant at creation time — never store
// a bare local time and compare it against the server clock.

/**
 * Default timezone when the profile hasn't set one. This app is for MSRIT
 * students, so we default to Indian Standard Time — every reminder's due_at is
 * computed from IST wall-clock → UTC unless the user picks another zone on their
 * profile. (pg_cron + the Edge Function run in UTC and compare the stored UTC.)
 */
export const DEFAULT_TZ = 'Asia/Kolkata'

/**
 * The offset (ms) of `timeZone` at the given instant: local - UTC.
 * Positive east of UTC. Uses the standard formatter round-trip so it accounts
 * for DST at that particular date.
 */
function tzOffsetMs(instant: Date, timeZone: string): number {
  // en-US formats as "M/D/YYYY, HH:MM:SS" which Date can re-parse.
  const asTz = new Date(instant.toLocaleString('en-US', { timeZone }))
  const asUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }))
  return asTz.getTime() - asUtc.getTime()
}

/**
 * Interpret a wall-clock time (date parts) as being in `timeZone` and return
 * the absolute UTC Date.
 *
 * @param y full year, @param mo 1-12, @param d 1-31, @param h 0-23, @param mi 0-59
 */
export function zonedWallTimeToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  timeZone: string,
): Date {
  // Start by treating the wall time as if it were UTC…
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi, 0)
  // …then subtract the tz offset at (approximately) that instant to land on the
  // true UTC instant for that wall time in the zone.
  const offset = tzOffsetMs(new Date(naiveUtc), timeZone)
  return new Date(naiveUtc - offset)
}

/** Convert an <input type="datetime-local"> value (in `timeZone`) to a UTC ISO string. */
export function datetimeLocalToUtcIso(value: string, timeZone: string): string {
  // value: 'YYYY-MM-DDTHH:MM'
  const [datePart, timePart] = value.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  return zonedWallTimeToUtc(y, mo, d, h, mi, timeZone).toISOString()
}

/**
 * Next occurrence (UTC ISO) of a daily wall-clock time in `timeZone`. If today's
 * occurrence is already past, returns tomorrow's.
 * @param hhmm 'HH:MM'
 */
export function nextDailyOccurrenceUtcIso(hhmm: string, timeZone: string): string {
  const [h, mi] = hhmm.split(':').map(Number)
  // "Now" expressed as wall-clock parts in the target zone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const y = get('year')
  const mo = get('month')
  const d = get('day')

  let due = zonedWallTimeToUtc(y, mo, d, h, mi, timeZone)
  if (due.getTime() <= Date.now()) {
    // Roll to tomorrow's wall time (handles month/year rollover via Date math).
    const t = new Date(Date.UTC(y, mo - 1, d + 1))
    due = zonedWallTimeToUtc(
      t.getUTCFullYear(),
      t.getUTCMonth() + 1,
      t.getUTCDate(),
      h,
      mi,
      timeZone,
    )
  }
  return due.toISOString()
}

/**
 * A deadline reminder: N days before `deadline` (YYYY-MM-DD) at `hhmm` local.
 * Returns a UTC ISO string.
 */
export function deadlineReminderUtcIso(
  deadline: string,
  daysBefore: number,
  hhmm: string,
  timeZone: string,
): string {
  const [y, mo, d] = deadline.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, mo - 1, d - daysBefore))
  const [h, mi] = hhmm.split(':').map(Number)
  return zonedWallTimeToUtc(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    h,
    mi,
    timeZone,
  ).toISOString()
}

/** Tomorrow at `hhmm` local (for the "snooze until tomorrow" option). */
export function tomorrowAtUtcIso(hhmm: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const t = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + 1))
  const [h, mi] = hhmm.split(':').map(Number)
  return zonedWallTimeToUtc(
    t.getUTCFullYear(),
    t.getUTCMonth() + 1,
    t.getUTCDate(),
    h,
    mi,
    timeZone,
  ).toISOString()
}

/** UTC ISO -> 'YYYY-MM-DDTHH:MM' wall time in `timeZone` (for datetime-local inputs). */
export function isoToDatetimeLocal(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  // en-CA gives 24h but may render '24' for midnight; normalise.
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/** Human-friendly local render of a UTC ISO string in `timeZone`. */
export function formatInTz(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString(undefined, {
    timeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

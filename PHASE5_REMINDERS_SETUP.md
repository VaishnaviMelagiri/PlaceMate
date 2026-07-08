# Phase 5 — Reminders + Push: setup & deploy

Everything here is one-time setup. Frontend keeps working without it; you just
won't receive push until the Edge Functions + cron are live.

## 0. Schema change (timezone)

`placemate_schema.sql` now includes a `timezone` column on `profiles`. If your
DB predates this, run once in the Supabase SQL editor:

```sql
alter table profiles add column if not exists timezone text default 'Asia/Kolkata';
```

## 1. Generate VAPID keys (once)

```bash
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. Where each goes:

| Key | Goes to | Exposed to browser? |
|---|---|---|
| Public key | Frontend `.env` → `VITE_VAPID_PUBLIC_KEY` **and** Edge secret `VAPID_PUBLIC_KEY` | Yes (safe) |
| Private key | Edge secret `VAPID_PRIVATE_KEY` **only** | ❌ Never |

Add the public key to `.env`:

```
VITE_VAPID_PUBLIC_KEY=<public key>
```

## 2. Set Edge Function secrets

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by Supabase automatically — you only set the VAPID ones:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="<public key>" \
  VAPID_PRIVATE_KEY="<private key>" \
  VAPID_SUBJECT="mailto:you@msrit.edu"
```

> Secrets live only in the Edge runtime. The service-role and VAPID private keys
> never reach the frontend bundle.

## 3. Deploy the functions

```bash
supabase link --project-ref <PROJECT_REF>     # once
supabase functions deploy subscribe-push
supabase functions deploy send-due-reminders
```

`subscribe-push` is called from the browser (JWT-verified). `send-due-reminders`
is called by cron with the service-role key.

## 4. Schedule the dispatcher (pg_cron every 5 min)

In the Supabase SQL editor, once — replacing the two placeholders:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-due-reminders',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://<PROJECT_REF>.functions.supabase.co/send-due-reminders',
      headers := jsonb_build_object(
                   'Content-Type','application/json',
                   'Authorization','Bearer <SERVICE_ROLE_KEY>')
    );
  $$
);
```

To change or remove it later: `select cron.unschedule('send-due-reminders');`

## 5. Test (Android / desktop Chrome first)

1. `.env` has `VITE_VAPID_PUBLIC_KEY`; restart `npm run dev`.
2. Open the app → **Reminders** → **Enable** notifications (grant permission).
3. Add an "apply" reminder a couple of minutes out, or turn on the daily check.
4. Within ~5 min the cron fires and you get a push with **10 min / 1 hr /
   Tomorrow** snooze buttons. Snooze reschedules (status → `snoozed`,
   `snoozed_until` set); the next cron run re-delivers it.

## iOS note

iOS Web Push only works when the PWA is **installed to the Home Screen**
(iOS 16.4+). Test on **Android / desktop Chrome** first; the install-to-home
prompt comes in Phase 8. Email fallback (Resend) is a later, optional flag.

## How timezones are handled

All reminder `due_at` values are real UTC `timestamptz`. The frontend converts
the user's local wall-clock time in their profile timezone → UTC at creation
(`src/lib/time.ts`). pg_cron and the function compare against `now()` in UTC —
we never compare a bare local time to the server clock.

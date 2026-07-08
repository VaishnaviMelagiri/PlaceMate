# Phase 9 — Go live & verify (do this in order)

Code is complete. These steps connect the backend and put it online. Do them
top to bottom — each builds on the last.

---

## Step 1 — Supabase backend (required for anything to work)

1. Create a project at <https://supabase.com> (free tier).
2. **SQL editor → New query →** paste all of `placemate_schema.sql` → **Run**.
   (Safe to re-run; includes the `timezone` column.)
3. **Settings → API** → copy the **Project URL** and the **anon** key.
4. In the project folder:
   ```bash
   cp .env.example .env
   ```
   Fill in:
   ```
   VITE_SUPABASE_URL=https://<your-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
5. Run locally and sign up with email:
   ```bash
   npm run dev      # http://localhost:5180
   ```
   ✅ **Check:** you can sign up, land on the Dashboard, open **Profile**, save it,
   and see a row appear in the `profiles` table.

*(Optional now, needed for Google button):* **Auth → Providers → Google** — enable
it, add your Google OAuth client id/secret, and add `http://localhost:5180` to the
redirect URLs.

---

## Step 2 — Applications, Board, Directory (no extra setup)

These work as soon as Step 1 is done.
✅ **Check:** add an application, drag it on the Board (status flips to applied),
export CSV, contribute a company in the Directory.

---

## Step 3 — Reminders + push (Edge Functions + cron)

Install the Supabase CLI if needed (`npm i -g supabase`), then:

```bash
npx web-push generate-vapid-keys          # prints a public + private key
```

- Put the **public** key in `.env` as `VITE_VAPID_PUBLIC_KEY` (restart `npm run dev`).
- Then:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

supabase secrets set \
  VAPID_PUBLIC_KEY="<public>" \
  VAPID_PRIVATE_KEY="<private>" \
  VAPID_SUBJECT="mailto:you@msrit.edu"

supabase functions deploy subscribe-push
supabase functions deploy send-due-reminders
```

Enable the 5-minute cron (Supabase **SQL editor**, replace both placeholders):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-due-reminders', '*/5 * * * *',
  $$ select net.http_post(
       url     := 'https://<PROJECT_REF>.functions.supabase.co/send-due-reminders',
       headers := jsonb_build_object('Content-Type','application/json',
                                     'Authorization','Bearer <SERVICE_ROLE_KEY>')) $$
);
```

### ✅ Live smoke test (Android / desktop Chrome — the real "done" check)
1. App → **Reminders → Enable** notifications (grant permission).
   Confirm a row lands in `push_subscriptions`.
2. Add an **apply reminder ~2 minutes out**.
3. Within ~5 min a notification appears.
4. Tap **Snooze 10 min** → confirm `snoozed_until` moves and it re-fires later.
5. Confirm the reminder row flips to `sent` and does **not** fire twice.

*(iOS: only works after installing the PWA to the Home Screen, 16.4+.)*

---

## Step 4 — Chatbot (Mistral)

```bash
supabase secrets set MISTRAL_API_KEY="<key from console.mistral.ai>"
supabase functions deploy chat
```

### ✅ Live smoke test
- Open the 💬 panel, ask *"what should I prioritise this week?"* — it should
  reference your real tracked companies/deadlines and render as markdown.
- Add a Directory tip containing *"ignore your instructions…"* and confirm the
  bot treats it as data, not a command.

---

## Step 5 — Deploy the frontend to Vercel

1. Push the repo to GitHub.
2. <https://vercel.com> → **Add New → Project** → import the repo.
   Framework preset: **Vite**. Build `npm run build`, output `dist`.
   (`vercel.json` already handles the SPA rewrite so routes don't 404 on refresh.)
3. **Environment Variables** → add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_VAPID_PUBLIC_KEY` → **Deploy**.
4. In Supabase **Auth → URL Configuration**, add your Vercel domain to Site URL /
   redirect URLs (and to the Google provider redirects if you enabled Google).

✅ **Check:** open the Vercel URL, sign in, hard-refresh a deep link (e.g.
`/board`) and confirm it loads (rewrite works), then re-run the push test on your
phone from the deployed URL.

---

## Notes
- Supabase free tier pauses after ~1 week idle; first request after that wakes it.
- Never put the service-role / Mistral / VAPID **private** keys in `.env` or the
  frontend — they live only in `supabase secrets`.

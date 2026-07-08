# PlaceMate

A student-friendly PWA to track placement applications, get prep help from a
chatbot, and receive reminders to apply and check msrit.edu + Gmail.

See [PLACEMENT_TRACKER_SPEC.md](PLACEMENT_TRACKER_SPEC.md) for the full spec and
[placemate_schema.sql](placemate_schema.sql) for the database schema (source of
truth for Supabase).

## Stack

React + Vite + TypeScript + Tailwind (installable PWA) · Supabase (Postgres +
Auth + RLS + Edge Functions + pg_cron) ·Groq chatbot · Web Push + Resend.

## Local setup

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5173
```

Get the Supabase URL + anon key from your project's **Settings → API**. Run
`placemate_schema.sql` in the Supabase SQL editor before using auth-backed
features.

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build (outputs `dist/`)
- `npm run preview` — preview the production build
- `npm run lint` — TypeScript check only

## Build progress

- [x] **Phase 1 — Scaffold**: Vite + React + TS + Tailwind, installable PWA
      (manifest + service worker, offline app shell), Supabase client wired to
      `VITE_` env vars.
- [x] **Phase 2 — Auth**: email/password (durable sessions), protected routes,
      profile screen. (Google sign-in removed — email only.)
- [ ] Phase 3 — Applications CRUD (list, search, filter, sort)
- [ ] Phase 4 — Board (Kanban) + Dashboard
- [x] **Phase 5 — Reminders + snooze**: timezone-aware scheduling, Web Push
      (custom service worker with snooze actions), `subscribe-push` +
      `send-due-reminders` Edge Functions, pg_cron. See
      [PHASE5_REMINDERS_SETUP.md](PHASE5_REMINDERS_SETUP.md).
- [x] **Phase 6 — Chatbot**: floating prep-assistant panel (markdown + typing
      indicator) backed by a `chat` Edge Function that verifies the JWT, loads
      the user's own applications + relevant directory rows (fenced as untrusted
      data), calls Mistral, and persists both turns. See
      [PHASE6_CHATBOT_SETUP.md](PHASE6_CHATBOT_SETUP.md).
- [ ] Phase 7 — Company directory
- [x] **Phase 8 — Polish**: dark-mode toggle (anti-FOUC, persisted), install-to-
      home-screen prompt (Chromium + iOS hint), empty states, CSV export.
- [ ] Phase 9 — Deploy to Vercel

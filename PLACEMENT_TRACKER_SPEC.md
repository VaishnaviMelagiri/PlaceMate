# PlaceMate — Placement Tracker + Prep Assistant (Build Spec)

A student-friendly, multi-user web app to track placement applications, get prep
help from a chatbot, and receive reminders/alarms to apply and to check
msrit.edu + Gmail. Fully deployable on free tiers.

This document is written to be handed directly to **Claude Code**. Paste it in,
let it scaffold, then work through the phases in order.

---

## 1. Goal (one line)

Let a student log companies they're applying to, mark applied/not-applied, get
reminded (with snooze) to apply and to check the placement site + email, and ask
a chatbot for prep help — and let their friends sign up and do the same.

---

## 2. Tech stack (all free tier)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS, built as a **PWA** (installable on phone) | Fast, free, works like a native app |
| Hosting | **Vercel** free tier | One-command deploy, HTTPS, custom subdomain |
| Auth + DB | **Supabase** free tier (Postgres, Auth, Row Level Security, Edge Functions, pg_cron) | Single platform: multi-user auth + database + scheduled jobs, no server to manage |
| Chatbot LLM | **Mistral AI** free tier, called from a Supabase Edge Function (key stays server-side) | Free, good enough for prep advice; swappable later |
| Push alerts | **Web Push** (self-generated VAPID keys) via service worker | Free phone/desktop notifications with snooze |
| Email reminders | **Resend** free tier (3k emails/mo) or Supabase's built-in mailer | Reliable fallback for reminders |

> Keep ALL secrets (Mistral key, Resend key, VAPID private key, Supabase service
> role key) in Supabase Edge Function env vars — never in the frontend bundle.

---

## 3. Core features (build these first — MVP)

1. **Auth** — email/password + Google sign-in (Supabase Auth). Each user's data
   is private via Row Level Security. Friends just sign up; no admin needed.
2. **Application tracker** — add/edit/delete a company entry with:
   - company name, role, CTC/stipend, location, mode (on-campus/off-campus)
   - application deadline (date)
   - eligibility (CGPA cutoff, branches, backlog policy) — free text or fields
   - **applied?** (yes/no) + applied date
   - status pipeline: `Interested → Applied → OA → Interview → Offer / Rejected`
   - notes, useful links (JD, apply link, prep resources)
3. **Views**
   - **Board (Kanban)** grouped by status, drag to move
   - **List/Table** with search, filter (status/applied/branch), sort by deadline
   - **Dashboard**: counts (interested / applied / offers), upcoming deadlines,
     "apply-soon" list
4. **Reminders + alarms (with snooze)**
   - Per-application "remind me to apply" alarm at a chosen time.
   - Auto-reminder N days before a deadline (default 2 days).
   - A **recurring daily reminder** to "check msrit.edu + Gmail" at a user-set
     time.
   - Delivery: Web Push notification + optional email.
   - **Snooze**: reschedules the reminder by 10 min / 1 hr / tomorrow.
5. **Prep chatbot**
   - Floating chat panel. Answers general prep questions (DSA, aptitude,
     resume, HR, company-specific rounds).
   - **Context-aware**: the Edge Function passes the user's stored applications
     (and the shared company directory, see below) into the prompt so it can say
     things like "You have 3 deadlines this week; prioritise X."
   - History persisted per user.

---

## 4. Nice-to-have features (phase 2 — makes it more usable)

- **Crowdsourced company directory (opt-in, shared read-only table).** Any user
  can contribute reusable info about a company (rounds, difficulty, questions
  asked, tips). Everyone benefits, and this becomes the "inside data" the
  chatbot draws on. Keep it separate from private applications; moderate with a
  simple `verified` flag.
- **Calendar view** of deadlines + interviews.
- **Tags** (e.g., "dream", "backup", "product", "service").
- **CSV import/export** of applications.
- **Dark mode** + clean student-friendly theme.
- **Streak / progress bar** ("applied to 5/8 open companies").
- **Share a single company card** with a friend (read-only link).

## 5. Phase 3 (optional, only if wanted later)

- **Gmail auto-check**: Gmail API OAuth to detect placement emails automatically
  instead of just reminding. Bigger scope — leave until MVP is solid.
- **Site change detection** for msrit.edu placement page (server-side poller in
  an Edge Function on pg_cron) that pushes a notification on change.

---

## 6. Data model (Postgres / Supabase)

```
profiles
  id (uuid, = auth.users.id)  full_name  branch  cgpa  grad_year  reminder_time

applications
  id  user_id(fk)  company_name  role  ctc  location  mode
  deadline(date)  eligibility(text)  applied(bool)  applied_date(date)
  status(enum)  notes(text)  links(jsonb)  tags(text[])  created_at  updated_at

reminders
  id  user_id(fk)  application_id(fk, nullable)  kind(enum: apply|deadline|daily_check)
  title  due_at(timestamptz)  recurrence(enum: none|daily)  status(enum: pending|sent|done|snoozed)
  snoozed_until(timestamptz nullable)  created_at

chat_messages
  id  user_id(fk)  role(user|assistant)  content(text)  created_at

company_directory   -- shared, opt-in
  id  company_name  info(jsonb: rounds, difficulty, questions, tips)
  contributed_by(fk)  verified(bool)  created_at

push_subscriptions
  id  user_id(fk)  endpoint  keys(jsonb)  created_at
```

**Row Level Security:** every table except `company_directory` filters on
`user_id = auth.uid()`. `company_directory` is world-readable, insert-only for
authenticated users.

---

## 7. Edge Functions (server-side)

1. `chat` — receives a user message + auth token; loads that user's applications
   + relevant `company_directory` rows; builds a prompt; calls Mistral; returns
   the reply; saves both messages.
2. `send-due-reminders` — triggered by **pg_cron every 5 min**; finds reminders
   where `due_at <= now()` and `status = pending` (or `snoozed_until <= now()`);
   sends Web Push + optional email; marks `sent`; if `recurrence = daily`,
   creates tomorrow's row.
3. `subscribe-push` — stores a browser's push subscription.

---

## 8. Suggested build order for Claude Code

1. Scaffold Vite + React + TS + Tailwind; set up Supabase project + client;
   configure PWA (manifest + service worker).
2. Auth (email + Google) with protected routes.
3. `applications` table + RLS + CRUD UI (list + form).
4. Board (Kanban) + Dashboard + filters.
5. `reminders` table + create-reminder UI + snooze; `send-due-reminders`
   function + pg_cron; Web Push subscribe flow; email fallback.
6. `chat` Edge Function + chat UI; wire in application context.
7. `company_directory` (opt-in shared) + contribute form; feed it to the chatbot.
8. Polish: dark mode, PWA install prompt, empty states, CSV export.
9. Deploy frontend to Vercel; set env vars; test push on a real phone.

---

## 9. Free-tier gotchas to tell the builder

- **iOS Web Push** only works when the PWA is *installed to the home screen*
  (iOS 16.4+). On Android/desktop Chrome it works normally. Email reminders
  cover the gap.
- Supabase free tier **pauses a project after ~1 week of inactivity** — fine for
  active use; just note it if the app "sleeps."
- Keep the Mistral prompt lean (only relevant applications + top directory rows)
  to stay within free-tier rate limits.
- Never ship the service-role key or LLM key to the browser; all privileged
  calls go through Edge Functions.

---

## 10. Environment variables

Frontend (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`
Edge Functions: `SUPABASE_SERVICE_ROLE_KEY`, `MISTRAL_API_KEY`, `RESEND_API_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

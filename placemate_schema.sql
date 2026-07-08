-- ============================================================
-- PlaceMate — Supabase schema (Postgres)
-- Paste into: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where sensible.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_cron";        -- scheduled reminder job

-- ---------- Enums ----------
do $$ begin
  create type application_status as enum
    ('interested','applied','oa','interview','offer','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_kind as enum ('apply','deadline','daily_check');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_recurrence as enum ('none','daily');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_status as enum ('pending','sent','done','snoozed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_role as enum ('user','assistant');
exception when duplicate_object then null; end $$;

-- ---------- updated_at helper ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- profiles  (1 row per auth user)
-- ============================================================
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  branch        text,
  cgpa          numeric(3,2),
  grad_year     int,
  reminder_time time default '09:00',    -- daily "check msrit.edu + gmail" time
  timezone      text default 'Asia/Kolkata',  -- IANA tz; local time -> UTC due_at
  created_at    timestamptz default now()
);

-- If profiles already exists from an earlier run, add the column:
alter table profiles add column if not exists timezone text default 'Asia/Kolkata';

alter table profiles enable row level security;

drop policy if exists "own profile - select" on profiles;
create policy "own profile - select" on profiles
  for select using (auth.uid() = id);

drop policy if exists "own profile - upsert" on profiles;
create policy "own profile - upsert" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "own profile - update" on profiles;
create policy "own profile - update" on profiles
  for update using (auth.uid() = id);

-- auto-create a profile row when a new user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- applications  (private, per user)
-- ============================================================
create table if not exists applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_name  text not null,
  role          text,
  ctc           text,                       -- keep text: "12 LPA", "45k stipend"
  location      text,
  mode          text,                       -- on-campus / off-campus
  deadline      date,
  eligibility   text,                        -- CGPA cutoff, branches, backlogs
  applied       boolean default false,
  applied_date  date,
  status        application_status default 'interested',
  notes         text,
  links         jsonb default '[]'::jsonb,   -- [{label, url}]
  tags          text[] default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_applications_user on applications(user_id);
create index if not exists idx_applications_deadline on applications(deadline);

drop trigger if exists applications_updated_at on applications;
create trigger applications_updated_at
  before update on applications
  for each row execute function set_updated_at();

alter table applications enable row level security;

drop policy if exists "own applications" on applications;
create policy "own applications" on applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- reminders  (private, per user; drives push/email + snooze)
-- ============================================================
create table if not exists reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  application_id uuid references applications(id) on delete cascade,
  kind           reminder_kind not null default 'apply',
  title          text not null,
  due_at         timestamptz not null,
  recurrence     reminder_recurrence not null default 'none',
  status         reminder_status not null default 'pending',
  snoozed_until  timestamptz,
  created_at     timestamptz default now()
);

create index if not exists idx_reminders_user on reminders(user_id);
create index if not exists idx_reminders_due  on reminders(due_at)
  where status in ('pending','snoozed');

alter table reminders enable row level security;

drop policy if exists "own reminders" on reminders;
create policy "own reminders" on reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- chat_messages  (private, per user)
-- ============================================================
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        message_role not null,
  content     text not null,
  created_at  timestamptz default now()
);

create index if not exists idx_chat_user on chat_messages(user_id, created_at);

alter table chat_messages enable row level security;

drop policy if exists "own chat" on chat_messages;
create policy "own chat" on chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- company_directory  (SHARED, opt-in crowdsourced info)
--   world-readable to logged-in users; anyone logged in can add;
--   you can only edit/delete your own contribution.
-- ============================================================
create table if not exists company_directory (
  id              uuid primary key default gen_random_uuid(),
  company_name    text not null,
  info            jsonb default '{}'::jsonb,   -- {rounds, difficulty, questions, tips}
  contributed_by  uuid references auth.users(id) on delete set null,
  verified        boolean default false,
  created_at      timestamptz default now()
);

create index if not exists idx_directory_name on company_directory(lower(company_name));

alter table company_directory enable row level security;

drop policy if exists "directory - read all (auth)" on company_directory;
create policy "directory - read all (auth)" on company_directory
  for select to authenticated using (true);

drop policy if exists "directory - insert own" on company_directory;
create policy "directory - insert own" on company_directory
  for insert to authenticated with check (auth.uid() = contributed_by);

drop policy if exists "directory - update own" on company_directory;
create policy "directory - update own" on company_directory
  for update using (auth.uid() = contributed_by);

drop policy if exists "directory - delete own" on company_directory;
create policy "directory - delete own" on company_directory
  for delete using (auth.uid() = contributed_by);

-- ============================================================
-- push_subscriptions  (private; one browser/device = one row)
-- ============================================================
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null,               -- {p256dh, auth}
  created_at  timestamptz default now()
);

create index if not exists idx_push_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "own push subs" on push_subscriptions;
create policy "own push subs" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- pg_cron: run the reminder dispatcher every 5 minutes.
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> after deploying the
-- 'send-due-reminders' Edge Function, then run this block once.
-- ============================================================
-- select cron.schedule(
--   'send-due-reminders',
--   '*/5 * * * *',
--   $$
--     select net.http_post(
--       url     := 'https://<PROJECT_REF>.functions.supabase.co/send-due-reminders',
--       headers := jsonb_build_object(
--                    'Content-Type','application/json',
--                    'Authorization','Bearer <SERVICE_ROLE_KEY>')
--     );
--   $$
-- );
-- (Requires the pg_net extension: create extension if not exists pg_net;)

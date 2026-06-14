-- XC Training — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ── Athlete profiles ─────────────────────────────────────────────────────────
create table if not exists athlete_profiles (
  user_id      uuid references auth.users on delete cascade primary key,
  name         text default '',
  school       text default '',
  sport        text default 'XC · Track',
  vo_max       numeric,
  agreed_to_tos boolean default false,
  agreed_at    timestamptz,
  created_at   timestamptz default now()
);

-- ── Runs (imported FIT/GPX data) ─────────────────────────────────────────────
create table if not exists runs (
  user_id        uuid references auth.users on delete cascade not null,
  id             text not null,
  date           date not null,
  mileage        numeric default 0,
  duration_min   numeric default 0,
  avg_pace       text,
  avg_hr         integer,
  max_hr         integer,
  avg_cadence    integer,
  elev_gain_ft   integer,
  aerobic_effect numeric,
  anaerobic_effect numeric,
  tss            numeric,
  trimp          numeric,
  sport          text,
  filename       text,
  vo2max         numeric,
  hr_zones       jsonb,
  laps           jsonb,
  created_at     timestamptz default now(),
  primary key (user_id, id)
);

-- ── Training plan weeks ───────────────────────────────────────────────────────
create table if not exists weeks (
  user_id          uuid references auth.users on delete cascade not null,
  id               text not null,
  start_date       date not null,
  planned_mileage  numeric default 0,
  actual_mileage   numeric default 0,
  days             jsonb default '[]',
  created_at       timestamptz default now(),
  primary key (user_id, id)
);

-- ── Personal records ──────────────────────────────────────────────────────────
create table if not exists personal_records (
  user_id   uuid references auth.users on delete cascade not null,
  event     text not null,
  time_str  text default '',
  date_set  date,
  primary key (user_id, event)
);

-- ── Row Level Security (CRITICAL — keeps each user's data private) ────────────
alter table athlete_profiles  enable row level security;
alter table runs              enable row level security;
alter table weeks             enable row level security;
alter table personal_records  enable row level security;

-- Each user can only read/write their own rows
create policy "own_profile" on athlete_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_runs" on runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_weeks" on weeks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own_prs" on personal_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

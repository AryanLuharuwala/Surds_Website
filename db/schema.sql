-- Survey telemetry schema (Neon Postgres).
-- api/track.js runs these CREATE IF NOT EXISTS statements on first request, so you don't
-- have to run this by hand — it's here as documentation and for manual setup if wanted:
--   psql "$DATABASE_URL" -f db/schema.sql

-- One row per visit/session. Rolls up the headline metrics so you can query drop-off,
-- start-CTR and completion without scanning every event.
create table if not exists survey_sessions (
  session_id     text primary key,
  survey         text,
  started_at     timestamptz,
  last_seen_at   timestamptz,
  user_agent     text,
  referrer       text,
  language       text,
  timezone       text,
  viewport       text,
  screen         text,
  reached_step   text,          -- last step name the visitor saw (drop-off point)
  reached_index  int,           -- 0=hook, 1..5=questions, 6=gate, 7=results
  started_survey boolean default false,  -- pressed "Start" (for start-CTR)
  submitted      boolean default false,  -- pressed the final submit
  completed      boolean default false,  -- reached the results screen
  answers        jsonb,         -- latest snapshot of chosen options / typed text
  meta           jsonb,
  created_at     timestamptz default now()
);

-- Append-only event log: every click, keystroke, option pick, step view, etc.
-- t_ms is the survey's internal clock (ms since the session started).
create table if not exists survey_events (
  id          bigserial primary key,
  session_id  text,
  survey      text,
  seq         int,             -- per-session ordinal
  t_ms        integer,         -- ms since session start (internal clock)
  client_ts   timestamptz,
  server_ts   timestamptz default now(),
  type        text,            -- session_start | landing_view | start_click | step_view
                               -- | option_select | key | input | click | submit_attempt
                               -- | submit_success | complete | drop | heartbeat
  step        text,
  q           text,            -- question key
  target      text,            -- DOM selector/text for clicks
  value       text,            -- option value / input snapshot / key
  data        jsonb            -- full untyped payload
);

create index if not exists idx_survey_events_session on survey_events(session_id);
create index if not exists idx_survey_events_type    on survey_events(type);
create index if not exists idx_survey_events_survey  on survey_events(survey);

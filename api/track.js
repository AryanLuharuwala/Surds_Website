/* Vercel serverless function: survey telemetry ingest.
   The survey pages POST batches of events here (via navigator.sendBeacon / fetch keepalive).
   Events are appended to the survey_events table and rolled up into survey_sessions on Neon.

   Contract (POST JSON):
     { s: "<session-id>", survey: "<slug>", events: [ { seq, t, ts, type, ... }, ... ] }

   Locally, dev-server.py implements the same POST /api/track and appends the events to
   logs/survey-events.jsonl instead — same contract, so the survey behaves identically in
   local dev and production. */
// Lazy so a missing DATABASE_URL degrades to a no-op (ok:false) instead of crashing the
// whole function at cold start. Set DATABASE_URL in the Vercel project env to enable storage.
let sql = null;
try { ({ sql } = require('../db/client')); } catch (_) { sql = null; }

let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`create table if not exists survey_sessions (
        session_id text primary key, survey text, started_at timestamptz, last_seen_at timestamptz,
        user_agent text, referrer text, language text, timezone text, viewport text, screen text,
        reached_step text, reached_index int, started_survey boolean default false,
        submitted boolean default false, completed boolean default false,
        answers jsonb, meta jsonb, created_at timestamptz default now())`;
      await sql`create table if not exists survey_events (
        id bigserial primary key, session_id text, survey text, seq int, t_ms integer,
        client_ts timestamptz, server_ts timestamptz default now(), type text, step text,
        q text, target text, value text, data jsonb)`;
      await sql`create index if not exists idx_survey_events_session on survey_events(session_id)`;
      await sql`create index if not exists idx_survey_events_type on survey_events(type)`;
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) { // Vercel may pre-parse
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const str = (v, n) => (v == null ? null : String(v).slice(0, n || 2000));
const isoOrNull = (v) => { try { return v ? new Date(v).toISOString() : null; } catch (_) { return null; } };

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(JSON.stringify({ ok: false, error: 'POST only' })); return; }

  try {
    const body = await readBody(req);
    const sessionId = str(body.s || body.session, 128);
    const survey = str(body.survey, 128) || 'unknown';
    const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
    if (!sessionId || !events.length) { res.status(200).end(JSON.stringify({ ok: true, stored: 0 })); return; }
    if (!sql) { res.status(200).end(JSON.stringify({ ok: false, error: 'DATABASE_URL not set' })); return; }

    await ensureSchema();

    // Insert events
    for (const e of events) {
      await sql`insert into survey_events (session_id, survey, seq, t_ms, client_ts, type, step, q, target, value, data)
        values (${sessionId}, ${survey}, ${e.seq ?? null}, ${Number.isFinite(e.t) ? Math.round(e.t) : null},
          ${isoOrNull(e.ts)}, ${str(e.type, 64)}, ${str(e.step, 64)}, ${str(e.q, 64)},
          ${str(e.sel || e.target, 400)}, ${str(e.value ?? e.key, 4000)}, ${JSON.stringify(e)}::jsonb)`;
    }

    // Roll up the session row from this batch (events arrive in order)
    const startEv = events.find((e) => e.type === 'session_start') || {};
    const m = startEv;
    const lastStep = [...events].reverse().find((e) => e.type === 'step_view' || e.type === 'drop');
    const answersEv = [...events].reverse().find((e) => e.answers);
    const startedSurvey = events.some((e) => e.type === 'start_click');
    const submitted = events.some((e) => e.type === 'submit_success' || e.type === 'submit_attempt');
    const completed = events.some((e) => e.type === 'complete');

    await sql`insert into survey_sessions
        (session_id, survey, started_at, last_seen_at, user_agent, referrer, language, timezone,
         viewport, screen, reached_step, reached_index, started_survey, submitted, completed, answers, meta)
      values (${sessionId}, ${survey}, ${isoOrNull(m.ts) || (isoOrNull(events[0] && events[0].ts))}, now(),
        ${str(m.ua, 500)}, ${str(m.referrer, 500)}, ${str(m.lang, 32)}, ${str(m.tz, 64)},
        ${str(m.viewport, 32)}, ${str(m.screen, 32)},
        ${str(lastStep && (lastStep.step || (lastStep.data && lastStep.data.reachedStep)), 64)},
        ${lastStep && Number.isFinite(lastStep.index) ? lastStep.index : null},
        ${startedSurvey}, ${submitted}, ${completed},
        ${answersEv ? JSON.stringify(answersEv.answers) : null}::jsonb, ${JSON.stringify(m)}::jsonb)
      on conflict (session_id) do update set
        last_seen_at = now(),
        reached_step = coalesce(excluded.reached_step, survey_sessions.reached_step),
        reached_index = greatest(coalesce(excluded.reached_index, -1), coalesce(survey_sessions.reached_index, -1)),
        started_survey = survey_sessions.started_survey or excluded.started_survey,
        submitted = survey_sessions.submitted or excluded.submitted,
        completed = survey_sessions.completed or excluded.completed,
        answers = coalesce(excluded.answers, survey_sessions.answers)`;

    res.status(200).end(JSON.stringify({ ok: true, stored: events.length }));
  } catch (e) {
    // Never fail loud — telemetry must not break the survey.
    res.status(200).end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
};

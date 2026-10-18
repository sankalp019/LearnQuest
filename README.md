# LearnQuest — Gamified Learning Platform

LearnQuest is a mobile-friendly gamified learning platform for MSOT students. It rewards verified learning behaviours, keeps game XP separate from official grades, gives students a path to progress outside top-rank competition, and gives faculty/admins tools to create quizzes and monitor engagement.

## What is included

- **Student experience:** challenge browsing, quiz attempts, XP/level progress, profile, clubs/events, leaderboard, and an opt-out for public identity display.
- **Fair play:** shuffled multiple-choice options on quiz load; answer grading remains server-side against protected answer keys; the exact displayed option order is snapshotted with submission.
- **Admin / superadmin:** platform and campus overview, campus creation, role changes with an audit reason, configurable XP economy, and question-bank authoring.
- **Campus admin:** campus-scoped overview, question-bank authoring, and XP economy settings.
- **Faculty:** campus engagement analytics, quiet-student follow-up, quiz performance/integrity signals, and question-bank authoring.
- **Database operations:** XP ledger, audited verified XP awards with idempotency and daily limits, privacy preference, quest/badge/battle schema, and role-protected RPCs.
- **Documentation and checks:** game design, cost/capacity sheet, setup notes, two sample quiz banks, test report, XP economy smoke tests, and a load-probe script.
- **Agent-ready instructions:** `.agent/rules/learnquest.md` records the Antigravity-friendly project rules and verification expectations.

The green/emerald visual style from the supplied project is retained.

## Prerequisites

- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- A Supabase project with Auth and PostgreSQL enabled
- The base schema from the supplied LearnQuest source, followed by every migration in `supabase/migrations/` in filename order

## Quick start

1. Configure Supabase in `.env.local` (do not commit this file):

   ```bash
   cp .env.example .env.local
   # Edit NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

2. Install and run:

   ```bash
   npm ci
   npm run dev
   ```

3. Open `http://localhost:3000` and register/sign in. For a local-only smoke test, you can run the static checks before connecting Supabase:

   ```bash
   npm run test:smoke
   ```

4. Apply migrations in filename order in the Supabase SQL editor or with the Supabase CLI after confirming the base tables from the supplied source are present. Never run the new migrations against a production database without a backup and a review of the existing schema.

## One-command container run

For the container, create the Compose `.env` file with real Supabase values (the development server uses `.env.local`):

```bash
cp .env.example .env
# Edit .env with real values
docker compose up --build
```

Then visit `http://localhost:3000`. The container build requires package registry access. The application requires the Supabase environment values to authenticate and persist data.

## Supabase setup and security

1. Start with the source project's original migrations and apply all migrations by filename in ascending order.
2. Confirm the initial platform administrator is assigned `super_admin` using a trusted database/admin process. Do not expose a service-role key in browser code.
3. The UI uses the publishable/anon key; authorization is enforced by session checks, role-gated routes, RLS, and database RPCs.
4. Faculty-created answer keys are stored separately from student-readable questions. Quiz scoring is server-side.
5. XP awards for attendance, assignments, clubs, and coding must only be sent after verifying the source record. The `award_verified_xp` RPC requires staff access, a source reference, configured action, daily limit, and idempotency.
6. A student can opt out of public identity display on the Profile page. This does not remove their XP or hide them from authorized faculty/admins.
7. Do not use real student data for demos/load tests without approval and consent.

## Useful commands

```bash
npm run dev                 # development server
npm run build               # production build
npm run lint                # ESLint
npm run test:smoke           # static submission checks + XP logic scenarios
npm run test:load            # HTTP load probe at 100/300/500 concurrent requests
```

For the load probe, start the app first. Configure `LOAD_TEST_URL`, `LOAD_TEST_PATH`, `LOAD_LEVELS`, and `LOAD_ROUNDS` as needed. The included probe measures HTTP endpoint latency only; it is **not** a WebRTC/audio simulation and does not prove 300-user live-scoreboard or full-system capacity. Record real deployment metrics and infrastructure details in `docs/TEST_REPORT.md` before claiming the scalability target is passed.

## Sample question bank

`sample-data/programming-daily-quest.json` contains a small programming quiz sample. Each question has four unique options, a correct answer that matches one option, points, and an explanation. This is a starter sample, not the 50 faculty-reviewed questions or two-subject bank required for a pilot submission.

## Honest readiness boundary

The repository contains implementation and repeatable local smoke checks, but this checkout does not include live Supabase credentials or a reachable package registry. Therefore the production build, live RLS/database integration, real concurrency measurements, faculty-reviewed quiz acceptance rate, and two-week engagement pilot cannot be represented as passed. See `docs/TEST_REPORT.md` for exact status and the final validation checklist. `docs/COST_AND_CAPACITY.md` explains the cost inputs and the required deployment-scale measurements.

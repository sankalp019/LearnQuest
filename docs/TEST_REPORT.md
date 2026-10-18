# LearnQuest Test Report

## Environment and reproducibility

- Project: supplied LearnQuest source, enhanced for the Gamified Learning Challenge.
- Runtime declared by project: Next.js 16, React 19, TypeScript, Supabase Auth/Postgres.
- Local static tests: Node.js 22.16.0 in the authoring environment.
- Live Supabase credentials, staging deployment, and institutional test cohort were not provided.

## Tests actually run

| Test | Method | Result |
|---|---|---|
| Required artifact check | `node scripts/verify-submission.mjs` | PASS: required routes, migrations, docs and sample data present |
| Sample question banks | Static validation of two JSON banks | PASS: 8 questions, four unique options each, answer matches one option |
| TypeScript/TSX syntax | Global TypeScript `transpileModule` over source files | PASS: 30 TS/TSX files transpiled with zero syntax diagnostics (not a full type-check) |
| Quiz randomization | Static source assertions | PASS: Fisher–Yates shuffle is present; displayed order is included in submission snapshot |
| XP rule simulation | `node scripts/xp-economy.test.mjs` | PASS: 10 scripted learner scenarios, expected total 210 XP, idempotency and daily-limit checks |
| Anti-gaming smoke scenarios | Scripted replay, missing evidence, daily cap, unknown action, duplicate peer award | PASS in the local deterministic simulation |
| Quiz participation report | Submission marker checks and TSX syntax transpilation | PASS: student matrix, detailed rows, status/date filters, campus filter for superadmin, latest attempt score/date and participation rate UI present |
| Fairness smoke scenario | Personal-improvement award independent of leaderboard rank | PASS in the local deterministic simulation |
| Production build | `npm run build` | NOT RUN successfully: installed dependencies are incomplete and registry access was unavailable in this environment |
| ESLint | `npm run lint` | NOT RUN successfully: ESLint executable/dependencies are unavailable in this environment |
| Supabase migration/RLS integration | Apply migrations to staging and exercise authenticated roles | NOT RUN: no Supabase credentials/database access |
| Real 100/300/500-user load test | Authenticated concurrent sessions and realtime scoreboard | NOT RUN: no staging deployment; HTTP probe is supplied but not claimed as a full-system test |
| Faculty-reviewed quiz quality / 2-week engagement pilot | Human review and cohort telemetry | NOT RUN: requires faculty and volunteer participants |

Run available local checks:

```bash
npm run test:smoke
npm run build
npm run lint
```

To measure a deployed HTTP endpoint:

```bash
LOAD_TEST_URL=https://your-staging-host.example LOAD_TEST_PATH=/ LOAD_ROUNDS=3 npm run test:load
```

## Known boundaries that must not be misrepresented

- The two sample banks are starter data; they are not 50 faculty-reviewed generated questions.
- Attendance, assignment, club and coding-platform integrations are not configured. Verified XP awards must not be made without validating the upstream record.
- Badges, quests, streak freeze accounting, and team battle persistence are represented in the database layer; full lifecycle UIs and realtime battle delivery are not yet demonstrated end-to-end.
- The current all-time leaderboard does not implement weekly league placement, promotion/relegation, or season resets.
- Quiz participation shows published quizzes and each student’s latest recorded attempt per quiz. The current schema does not store publication-history timestamps or class identifiers, so historical quiz availability and class-level filtering cannot be independently verified. Staff access remains subject to Supabase row-level security; verify campus boundaries against a staging database.
- The anti-gaming checks here are deterministic smoke tests, not a real student cohort study or proof of answer-sharing detection accuracy.
- No real load test, measured breaking point, pilot results, or vendor-specific cost total is claimed.

## Final pre-demo checklist

1. Configure `.env.local` with the Supabase URL and publishable key; never commit secrets.
2. Back up the database and apply all migrations in ascending filename order against the matching base schema.
3. Assign a trusted first `super_admin` and verify each role using separate test accounts.
4. Confirm a student cannot read answer keys, another student's private profile, or another campus's restricted records.
5. Create and publish a challenge, complete it twice, and confirm XP is awarded only once.
6. Load the same quiz repeatedly; confirm positions vary and the submitted snapshot matches the displayed option order.
7. Toggle anonymous leaderboard mode and verify name/avatar masking from a separate student account.
8. Test faculty quiz creation, campus creation, XP rule edit, role change audit, and unauthorized calls.
9. Run build/lint and the 100/300/500 deployment load tests in an environment with package registry access and staging resources.
10. Get faculty review of at least 50 questions and run a consented two-week engagement pilot before claiming those requirements passed.

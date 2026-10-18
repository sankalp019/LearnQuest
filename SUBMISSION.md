# LearnQuest Submission Index

**Challenge:** Problem 4 — Gamified Learning Challenge

## Deliverables included

- Source app: Next.js / React / TypeScript / Supabase.
- Role dashboards: student, faculty, campus admin and superadmin.
- Quiz/question-bank creation, server-side answer-key grading integration, randomized option order and displayed-order snapshot.
- Quiz participation reports on faculty and superadmin dashboards: student-by-quiz matrix, attempted/not-attempted status, latest score and completion date, participation rate, search, quiz/date filters, and superadmin campus filter.
- Configurable XP rules, XP ledger/idempotency, staff audit trail, distinct-day streak logic, limited freeze field, anonymous leaderboard preference, starter badge/quest/team-battle schema.
- Supabase migrations and environment template.
- Two starter question banks: programming and data structures.
- Game design and architecture: `docs/GAME_DESIGN.md`.
- Cost/capacity sheet: `docs/COST_AND_CAPACITY.md`.
- Test report: `docs/TEST_REPORT.md`.
- Repeatable static and XP smoke tests: `npm run test:smoke`.
- HTTP load probe: `npm run test:load`.
- One-command container configuration: `docker compose up --build` after `.env` setup.

## Verification status

Local deterministic checks pass. Full production build, lint, live Supabase/RLS verification, faculty review, two-week engagement pilot, and 100/300/500-user deployment load tests are **not verified** in this environment. See the Test Report. This is an implementation submission package, not a claim that a live hosted deployment has already passed all pilot acceptance gates.

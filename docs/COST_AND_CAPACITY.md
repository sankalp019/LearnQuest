# Cost and Capacity Sheet

## Cost model

This submission uses Next.js, Supabase Auth/Postgres and browser-side quiz UI. It does not currently call a paid LLM API, so **LLM cost per learner for the implemented flow is ₹0**. This is not the same as zero infrastructure cost: hosting, database, storage, egress, backups and monitoring depend on the chosen vendor plan and region.

| Cost item | Calculation | Status |
|---|---|---|
| LLM/API calls | Implemented quiz flow does not call an LLM | ₹0 per viva/quiz in current implementation |
| Web hosting | monthly hosting bill ÷ monthly active learners | Must be filled from chosen host quote |
| Supabase database/Auth | project monthly bill ÷ active learners | Must be filled from chosen Supabase plan/usage |
| Storage/egress/backups | actual stored GB × plan rate + transfer | Requires pilot measurements |
| Total per learner | sum of infrastructure and operations cost ÷ learners | Not honestly calculable before deployment |
| Cohort cost | per-learner cost × 1,000 students (brief's scale target) | Fill after measuring real usage |

Do not advertise a total cost without a selected plan and usage data. This table is designed to make the missing inputs explicit rather than invent prices.

## Capacity target and test method

The brief asks for 1,000+ students across four campuses, live leaderboards, 300 simultaneous team-battle submissions with scoreboard updates within 2 seconds, and load tests at 100, 300 and 500 concurrent users. `scripts/load-test.mjs` provides a repeatable HTTP probe; it does not simulate authenticated quiz submissions, Supabase Realtime, mobile networks or simultaneous database writes.

Run against a deployment that is safe to test:

```bash
LOAD_TEST_URL=https://your-staging-host.example LOAD_TEST_PATH=/ LOAD_ROUNDS=3 npm run test:load
```

Record p50/p95 latency, error rate, CPU, memory, database connections, database query latency, and dropped realtime messages. For a meaningful scoreboard test, use authenticated test accounts and a dedicated staging database; do not load-test production student data.

## Capacity plan

- Stateless Next.js application instances behind a managed load balancer.
- Supabase/Postgres connection pooling; inspect query plans and add indexes before the pilot.
- Keep quiz scoring and XP writes transactional in Postgres; use idempotency keys for retry safety.
- Use Supabase Realtime or a dedicated WebSocket service for live battle updates only after a measured concurrency test; batch/aggregate score updates instead of writing every UI tick.
- Configure rate limits, bounded retries with jitter, user-visible retry states, and a queue for external integrations.
- Scale the web tier horizontally; scale database resources based on measured CPU, I/O, connections and lock contention.

No concurrency result is claimed in this repository because the environment did not provide a running configured staging service.

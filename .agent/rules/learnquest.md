# LearnQuest project rules (Antigravity / agentic IDE)

- Treat `Student Challenge (1).docx` Problem 4 as the product requirements source of truth.
- Preserve the existing dark/emerald-green visual identity; improve information hierarchy without replacing the design system.
- Never claim a build, database integration, faculty review, engagement pilot, or load test passed unless the command/result or real measurements are in the repository.
- Never add Supabase service-role keys or student personal data to client code, `.env.example`, commits, logs, or generated sample files.
- All XP awards must have a verifiable source reference, be idempotent, respect configured limits, and be audit logged. XP never changes official grades.
- Keep quiz answer keys server-only; grading must use the protected database RPC and answer text, not option position.
- Randomize options per fresh quiz load and persist the exact displayed order in the submission snapshot.
- Respect RLS and campus boundaries. Do not replace server-side role checks with UI-only hiding.
- Before a handoff, run `npm run test:smoke`, attempt `npm run build` and `npm run lint`, and state honestly which could not run because dependencies or environment services are unavailable.
- Apply database migrations only after checking the existing schema and taking a backup; do not silently rewrite live data.

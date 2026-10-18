import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const required = [
  'app/admin/page.tsx','app/campus-admin/page.tsx','app/faculty/page.tsx',
  'app/challenges/[id]/page.tsx','components/AdminControls.tsx','components/QuizParticipationReport.tsx','lib/analytics/fetch-quiz-attempts.ts',
  'supabase/migrations/20261017_learnquest_operations.sql',
  'supabase/migrations/20261018_admin_role_management.sql',
  'supabase/migrations/20261019_faculty_question_bank.sql',
  'supabase/migrations/20261020_rbac_policy_helpers.sql',
  'supabase/migrations/20261021_gamification_completion.sql',
  'docs/GAME_DESIGN.md','docs/TEST_REPORT.md','docs/COST_AND_CAPACITY.md','SUBMISSION.md','.agent/rules/learnquest.md','sample-data/programming-daily-quest.json','sample-data/data-structures-daily-quest.json','Dockerfile','docker-compose.yml',
];
for (const file of required) assert.ok(fs.existsSync(path.join(root,file)), `Missing ${file}`);
const quiz = JSON.parse(fs.readFileSync(path.join(root,'sample-data/programming-daily-quest.json'),'utf8'));
const dataStructures = JSON.parse(fs.readFileSync(path.join(root,'sample-data/data-structures-daily-quest.json'),'utf8'));
assert.ok(Array.isArray(quiz) && quiz.length >= 3, 'Programming sample needs >=3 questions');
assert.ok(Array.isArray(dataStructures) && dataStructures.length >= 3, 'Data structures sample needs >=3 questions');
for (const [bankName,bank] of [['programming',quiz],['data structures',dataStructures]]) {
 for (const [i,q] of bank.entries()) {
  assert.ok(typeof q.question_text === 'string' && q.question_text.trim(), `${bankName} question ${i+1} needs text`);
  assert.equal(q.options.length,4,`${bankName} question ${i+1} must have exactly 4 options`);
  assert.equal(new Set(q.options).size,4,`${bankName} question ${i+1} options must be unique`);
  assert.ok(q.options.includes(q.correct_answer),`${bankName} question ${i+1} answer must match one option`);
 }
}
const runner = fs.readFileSync(path.join(root,'app/challenges/[id]/page.tsx'),'utf8');
assert.match(runner,/shuffleOptions/,'Quiz runner must randomize option order');
assert.match(runner,/optionsSnapshot/i,'Quiz runner must persist shuffled option snapshot');
assert.match(runner,/optionsSnapshot\[q\.id\] = q\.options/,'Snapshot must match the actual displayed order');
const sql = fs.readFileSync(path.join(root,'supabase/migrations/20261021_gamification_completion.sql'),'utf8');
for (const needle of ['leaderboard_anonymous','set_leaderboard_anonymous','award_verified_xp','xp_ledger_source_idempotency_idx','user_quest_progress','team_battles','user_badges']) assert.ok(sql.includes(needle),`Missing SQL capability: ${needle}`);
const rbac = fs.readFileSync(path.join(root,'supabase/migrations/20261018_admin_role_management.sql'),'utf8');
assert.match(rbac,/admin_set_profile_role/);
const facultyApi = fs.readFileSync(path.join(root,'app/api/faculty/challenges/route.ts'),'utf8');
assert.match(facultyApi,/faculty_create_challenge/);
console.log(`PASS: ${required.length} required artifacts present`);
console.log(`PASS: two sample banks contain ${quiz.length + dataStructures.length} valid questions with four unique options and valid answer keys`);
const report = fs.readFileSync(path.join(root,'components/QuizParticipationReport.tsx'),'utf8');
assert.match(report,/Not attempted/,'Participation report must identify students without attempts');
assert.match(report,/Participation rate/,'Participation report must calculate participation rate');
assert.match(report,/fromDate/,'Participation report must support date filters');
assert.match(report,/showCampusFilter/,'Participation report must support campus scoping');
console.log('PASS: option randomization, snapshot, XP idempotency, privacy, quest, badge, battle, RBAC, and quiz participation reporting markers found');


import Link from 'next/link';
import { requireRole } from '@/lib/auth/require-role';
import { AccountRoleControl, CampusCreator, ChallengeCreator, XPRulesManager } from '@/components/AdminControls';
import QuizParticipationReport from '@/components/QuizParticipationReport';
import { fetchQuizAttempts, fetchQuizReportStudents } from '@/lib/analytics/fetch-quiz-attempts';

export const dynamic = 'force-dynamic';

const roleLabels: Record<string, string> = {
  student: 'Student',
  teacher: 'Teacher',
  campus_admin: 'Campus admin',
  super_admin: 'Super admin',
};

export default async function AdminPage() {
  const { supabase, profile } = await requireRole(['super_admin']);

  const [
    { data: campuses, error: campusesError },
    { data: profiles, error: profilesError },
    { data: challenges, error: challengesError },
    { data: attempts, error: attemptsError },
    { data: reportStudents, error: reportStudentsError },
  ] = await Promise.all([
    supabase
      .from('campuses')
      .select('id, name, code, created_at')
      .order('name'),
    supabase
      .from('profiles')
      .select('id, username, role, campus_id, xp, level, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('challenges')
      .select('id, title, subject, is_published, campus_id, created_at')
      .order('created_at', { ascending: false }),
    fetchQuizAttempts(supabase),
    fetchQuizReportStudents(supabase),
  ]);

  const campusList = campuses ?? [];
  const profileList = profiles ?? [];
  const studentList = reportStudents ?? profileList.filter((item) => (item.role ?? 'student') === 'student');
  const challengeList = challenges ?? [];
  const attemptList = attempts ?? [];

  const campusNames = new Map(
    campusList.map((campus) => [campus.id, campus.name])
  );

  const roleCounts = profileList.reduce<Record<string, number>>(
    (counts, item) => {
      const role = item.role ?? 'student';
      counts[role] = (counts[role] ?? 0) + 1;
      return counts;
    },
    {}
  );

  const stats = [
    { label: 'Campuses', value: campusesError ? '—' : campusList.length },
    { label: 'Accounts', value: profilesError ? '—' : profileList.length },
    { label: 'Students', value: profilesError ? '—' : roleCounts.student ?? 0 },
    {
      label: 'Staff accounts',
      value: profilesError
        ? '—'
        : (roleCounts.teacher ?? 0) + (roleCounts.campus_admin ?? 0),
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
              LearnQuest · Control Center
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Super Admin
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Signed in as {profile.username || 'Administrator'}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="w-fit rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
          >
            ← Student dashboard
          </Link>
        </header>

        <section>
          <h2 className="mb-4 text-sm font-medium text-zinc-400">
            Platform overview
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
              >
                <p className="text-sm text-zinc-400">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {stat.value}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Campus management</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Existing campuses registered in LearnQuest.
              </p>
            </div>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
              {campusesError ? 'Load failed' : `${campusList.length} campuses`}
            </span>
          </div>

          {campusesError ? (
            <div className="rounded-xl border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
              Could not load campuses: {campusesError.message}
            </div>
          ) : campusList.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-400">
              No campuses found.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {campusList.map((campus) => {
                const members = profileList.filter(
                  (item) => item.campus_id === campus.id
                );

                return (
                  <article
                    key={campus.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-emerald-500/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">
                          Campus
                        </p>
                        <h3 className="mt-2 text-lg font-semibold">
                          {campus.name}
                        </h3>
                      </div>
                      <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-mono text-xs text-emerald-300">
                        {campus.code}
                      </span>
                    </div>
                    <div className="mt-6 flex items-end justify-between border-t border-zinc-800 pt-4">
                      <div>
                        <p className="text-xs text-zinc-500">Assigned accounts</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {members.length}
                        </p>
                      </div>
                      <p className="text-xs text-zinc-500">Campus scoped</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Add a campus</h2>
            <p className="mt-1 text-sm text-zinc-400">Create a campus record for grouping students and staff. Campus codes must be unique.</p>
          </div>
          <CampusCreator />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
          <div className="mb-5"><h2 className="text-xl font-semibold">Question bank studio</h2><p className="mt-1 text-sm text-zinc-400">Create and publish approved daily quizzes and micro-challenges.</p></div>
          <ChallengeCreator />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">XP economy settings</h2>
            <p className="mt-1 text-sm text-zinc-400">Tune learning rewards without changing application code. Changes are audit logged.</p>
          </div>
          <XPRulesManager />
        </section>

        <QuizParticipationReport
          students={studentList.map(student => ({ id: student.id, username: student.username, campus_id: student.campus_id, xp: student.xp, level: student.level }))}
          quizzes={challengeList.map(quiz => ({ id: quiz.id, title: quiz.title, subject: quiz.subject, is_published: quiz.is_published, campus_id: quiz.campus_id }))}
          attempts={attemptList}
          campuses={campusList.map(campus => ({ id: campus.id, name: campus.name }))}
          showCampusFilter
          scopeLabel="Super admin view across all campuses."
          loadError={[reportStudentsError?.message, challengesError?.message, attemptsError?.message].filter(Boolean).join(' · ') || null}
        />

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Account directory</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Registered LearnQuest profiles. Account IDs are shortened for display.
            </p>
          </div>

          {profilesError ? (
            <div className="rounded-xl border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
              Could not load accounts: {profilesError.message}
            </div>
          ) : profileList.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-400">
              No profiles found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Campus</th>
                    <th className="px-4 py-3 font-medium">XP</th>
                    <th className="px-4 py-3 font-medium">Level</th>
                    <th className="px-4 py-3 font-medium">Account ID</th>
                    <th className="px-4 py-3 font-medium">Change role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {profileList.map((account) => (
                    <tr key={account.id} className="bg-zinc-950 hover:bg-zinc-900/60">
                      <td className="px-4 py-4 font-medium">
                        {account.username || 'Unnamed learner'}
                        {account.id === profile.id && (
                          <span className="ml-2 rounded border border-emerald-500/30 px-1.5 py-0.5 text-xs text-emerald-300">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs">
                          {roleLabels[account.role ?? 'student'] ?? account.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">
                        {account.campus_id
                          ? campusNames.get(account.campus_id) ?? 'Unknown campus'
                          : 'Unassigned'}
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {account.xp ?? 0}
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {account.level ?? 1}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-zinc-500">
                        {account.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3"><AccountRoleControl userId={account.id} initialRole={account.role ?? 'student'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">Account roles</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(roleLabels).map(([role, label]) => (
              <div
                key={role}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <p className="text-sm text-zinc-400">{label}s</p>
                <p className="mt-2 text-2xl font-semibold">
                  {profilesError ? '—' : roleCounts[role] ?? 0}
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-600">{role}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-zinc-800 pt-4 text-xs text-zinc-500">
          LearnQuest administration · Access restricted by server-side role checks
        </footer>
      </div>
    </main>
  );
}

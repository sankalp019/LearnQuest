import { requireRole } from '@/lib/auth/require-role';
import Link from 'next/link';
import { ChallengeCreator, XPRulesManager } from '@/components/AdminControls';

export default async function CampusAdminPage() {
  const { supabase, profile } = await requireRole(['campus_admin']);

  let query = supabase
    .from('profiles')
    .select('id, username, role, campus_id');

  if (profile.campus_id) {
    query = query.eq('campus_id', profile.campus_id);
  }

  const { data: accounts, error } = await query;
  const rows = accounts ?? [];

  const counts = {
    students: rows.filter((p) => p.role === 'student').length,
    faculty: rows.filter((p) => p.role === 'teacher').length,
    admins: rows.filter((p) => p.role === 'campus_admin').length,
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-mono uppercase tracking-widest text-emerald-400">
          LEARNQUEST · CAMPUS PORTAL
        </p>
        <h1 className="mt-3 text-3xl font-bold">Campus Admin Dashboard</h1>
        <p className="mt-2 text-zinc-400">
          Signed in as {profile.username ?? 'Campus Administrator'}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['Students', counts.students],
            ['Faculty', counts.faculty],
            ['Campus admins', counts.admins],
          ].map(([label, value]) => (
            <section key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-sm text-zinc-400">{label}</p>
              <p className="mt-3 text-3xl font-bold">{value}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold">Campus account directory</h2>
          {error ? (
            <p className="mt-4 text-amber-300">Could not load accounts. Check campus access policies.</p>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No accounts are assigned to this campus yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-zinc-400">
                  <tr><th className="py-3">Username</th><th>Role</th></tr>
                </thead>
                <tbody>
                  {rows.map((account) => (
                    <tr key={account.id} className="border-t border-zinc-800">
                      <td className="py-3">{account.username ?? 'Unnamed user'}</td>
                      <td>{account.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold">Question bank studio</h2>
          <p className="mb-5 mt-1 text-sm text-zinc-400">Create draft or published quizzes for your campus learners.</p>
          <ChallengeCreator />
        </section>

        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold">XP economy</h2>
          <p className="mb-5 mt-1 text-sm text-zinc-400">Manage the points attached to verified learning actions.</p>
          <XPRulesManager />
        </section>

        <Link href="/dashboard" className="mt-6 inline-block text-sm text-emerald-400 hover:underline">
          Open learning dashboard →
        </Link>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { ChallengeCreator } from '@/components/AdminControls';
import QuizParticipationReport from '@/components/QuizParticipationReport';
import { fetchQuizAttempts, fetchQuizReportStudents } from '@/lib/analytics/fetch-quiz-attempts';
import { requireRole } from '@/lib/auth/require-role';

export const dynamic = 'force-dynamic';

export default async function FacultyPage() {
  const { supabase, profile } = await requireRole(['teacher']);
  const [{ data: challenges, error: challengeError }, { data: students, error: studentError }, { data: attempts, error: attemptError }, { data: flags, error: flagError }] = await Promise.all([
    supabase.from('challenges').select('id,title,subject,difficulty,is_published,created_at,campus_id,created_by').order('created_at', { ascending: false }),
    fetchQuizReportStudents(supabase, profile.campus_id),
    fetchQuizAttempts(supabase),
    supabase.from('learning_flags').select('id,user_id,flag_type,description,status,created_at').eq('status','open').order('created_at',{ascending:false}).limit(20),
  ]);
  const activities = challenges ?? [];
  const learners = students ?? [];
  const quizAttempts = attempts ?? [];
  const learnerById = new Map(learners.map(s => [s.id, s]));
  const activeSince = new Date(); activeSince.setDate(activeSince.getDate()-7);
  const activeCount = learners.filter(s => s.last_activity_date && new Date(s.last_activity_date) >= activeSince).length;
  const avgScore = quizAttempts.length ? Math.round(quizAttempts.reduce((sum,a)=>sum + (Number(a.score)||0),0)/quizAttempts.length) : 0;
  const quietBefore = new Date();
  quietBefore.setDate(quietBefore.getDate() - 5);

  const quietLearners = learners.filter(
    (student) =>
      !student.last_activity_date ||
      new Date(student.last_activity_date) < quietBefore
  );
  const activityStats = activities.map(activity => {
    const rows = quizAttempts.filter(a=>a.challenge_id===activity.id);
    const avg = rows.length ? Math.round(rows.reduce((sum,a)=>sum+(Number(a.score)||0),0)/rows.length) : null;
    return { ...activity, attempts: rows.length, avg };
  }).sort((a,b)=>(a.avg ?? 101)-(b.avg ?? 101));

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-7 sm:flex-row sm:items-end">
          <div><p className="text-xs font-mono uppercase tracking-[0.24em] text-emerald-400">LEARNQUEST · FACULTY PORTAL</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Learning insights</h1><p className="mt-2 text-sm text-zinc-400">Welcome, {profile.username ?? 'Faculty Member'} · Track engagement and spot learning gaps early.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/challenges" className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-300">Open quizzes ↗</Link><Link href="/leaderboard" className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900">Leaderboard</Link></div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {label:'Students in scope',value:studentError?'—':learners.length,detail:'Your campus cohort',tone:'text-white'},
            {label:'Active this week',value:studentError?'—':activeCount,detail:'Based on latest activity date',tone:'text-emerald-300'},
            {label:'Quiz attempts',value:attemptError?'—':quizAttempts.length,detail:'Latest 500 records',tone:'text-white'},
            {label:'Open integrity flags',value:flagError?'—':(flags??[]).length,detail:'Needs staff review',tone:'text-amber-300'},
          ].map(stat=><article key={stat.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"><p className="text-sm text-zinc-400">{stat.label}</p><p className={`mt-3 text-3xl font-bold tabular-nums ${stat.tone}`}>{stat.value}</p><p className="mt-2 text-xs text-zinc-500">{stat.detail}</p></article>)}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Quiz performance</h2><p className="mt-1 text-sm text-zinc-400">Lower average scores highlight topics worth revisiting.</p></div><span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">{avgScore}% avg score</span></div>
            {challengeError ? <p className="mt-5 text-sm text-amber-300">Could not load activities. Check the database policies and migrations.</p> : activityStats.length===0 ? <p className="mt-5 rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">No quizzes yet. Create or publish learning activities to begin tracking performance.</p> : <div className="mt-5 space-y-4">{activityStats.slice(0,8).map(activity=><div key={activity.id}><div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{activity.title}</p><p className="mt-0.5 text-xs text-zinc-500">{activity.subject} · {activity.attempts} attempts</p></div><span className={`text-sm font-semibold tabular-nums ${activity.avg!==null&&activity.avg<60?'text-amber-300':'text-emerald-300'}`}>{activity.avg===null?'No data':`${activity.avg}%`}</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className={`h-full rounded-full ${activity.avg!==null&&activity.avg<60?'bg-amber-400':'bg-emerald-400'}`} style={{width:`${activity.avg??0}%`}} /></div></div>)}</div>}
            {attemptError && <p className="mt-4 text-xs text-amber-300">Attempt analytics are unavailable under the current database permissions.</p>}
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
            <div><h2 className="text-lg font-semibold">Needs a check-in</h2><p className="mt-1 text-sm text-zinc-400">Students with no activity in 5+ days.</p></div>
            {studentError ? <p className="mt-5 text-sm text-amber-300">Could not load student activity.</p> : quietLearners.length===0 ? <p className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">Everyone has a recent activity date. Keep encouraging consistent practice.</p> : <div className="mt-4 space-y-2">{quietLearners.slice(0,8).map(student=><div key={student.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{student.username??'Learner'}</p><p className="mt-1 text-xs text-zinc-500">{student.last_activity_date?`Last active ${student.last_activity_date}`:'No activity recorded'}</p></div><span className="shrink-0 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">Check in</span></div>)}</div>}
            {quietLearners.length>8&&<p className="mt-3 text-xs text-zinc-500">Showing 8 of {quietLearners.length} students.</p>}
          </div>
        </section>

        <QuizParticipationReport
          students={learners.map(student => ({ id: student.id, username: student.username, campus_id: student.campus_id, xp: student.xp, level: student.level }))}
          quizzes={activities.map(activity => ({ id: activity.id, title: activity.title, subject: activity.subject, is_published: activity.is_published, campus_id: activity.campus_id }))}
          attempts={quizAttempts}
          scopeLabel={profile.campus_id ? 'Limited to your campus cohort.' : 'Showing students visible to your staff account.'}
          loadError={[studentError?.message, challengeError?.message, attemptError?.message].filter(Boolean).join(' · ') || null}
        />

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
          <div className="mb-5"><h2 className="text-lg font-semibold">Create a daily quiz / micro-challenge</h2><p className="mt-1 text-sm text-zinc-400">Build a question bank, keep it as a draft for review, or publish it for students.</p></div>
          <ChallengeCreator />
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Learning activities</h2><p className="mt-1 text-sm text-zinc-400">Published status and engagement snapshot.</p></div><span className="text-xs text-zinc-500">{activities.filter(a=>a.is_published).length} published / {activities.length} total</span></div>
          {activities.length===0 ? <p className="text-sm text-zinc-400">No learning activities found yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-zinc-500"><tr><th className="pb-3 pr-4 font-medium">Activity</th><th className="pb-3 pr-4 font-medium">Subject</th><th className="pb-3 pr-4 font-medium">Difficulty</th><th className="pb-3 pr-4 font-medium">Attempts</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-zinc-800">{activities.map(a=><tr key={a.id}><td className="py-3 pr-4 font-medium">{a.title}</td><td className="py-3 pr-4 text-zinc-400">{a.subject}</td><td className="py-3 pr-4 text-zinc-400">{a.difficulty}</td><td className="py-3 pr-4 tabular-nums">{quizAttempts.filter(at=>at.challenge_id===a.id).length}</td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs ${a.is_published?'bg-emerald-400/10 text-emerald-300':'bg-zinc-800 text-zinc-400'}`}>{a.is_published?'Published':'Draft'}</span></td></tr>)}</tbody></table></div>}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
          <div className="mb-4"><h2 className="text-lg font-semibold">Integrity review queue</h2><p className="mt-1 text-sm text-zinc-400">Review unusual XP spikes or suspicious learning patterns. Any action should include a reason.</p></div>
          {flagError ? <p className="text-sm text-zinc-400">Integrity flags are not available yet. Apply the operations migration to enable the review queue.</p> : (flags??[]).length===0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">No open flags at the moment.</p> : <div className="space-y-3">{(flags??[]).map(flag=><div key={flag.id} className="rounded-xl border border-zinc-800 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{flag.flag_type.replaceAll('_',' ')}</p><span className="text-xs text-zinc-500">{new Date(flag.created_at).toLocaleDateString()}</span></div><p className="mt-2 text-sm text-zinc-400">{flag.description}</p><p className="mt-2 text-xs text-zinc-500">Student: {learnerById.get(flag.user_id)?.username??flag.user_id.slice(0,8)}</p></div>)}</div>}
        </section>
        <footer className="border-t border-zinc-800 pt-4 text-xs text-zinc-600">LearnQuest faculty insights · Analytics depend on available, permission-scoped records.</footer>
      </div>
    </main>
  );
}

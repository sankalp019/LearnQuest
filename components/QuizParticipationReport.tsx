'use client';

import { useMemo, useState } from 'react';

type Student = { id: string; username: string | null; campus_id?: string | null; xp?: number | null; level?: number | null };
type Quiz = { id: string; title: string; subject?: string | null; is_published?: boolean | null; campus_id?: string | null };
type Attempt = { id: string; user_id: string; challenge_id: string; score: number | null; total_questions: number | null; xp_earned?: number | null; completed_at: string | null };
type Campus = { id: string; name: string };
type Props = { students: Student[]; quizzes: Quiz[]; attempts: Attempt[]; campuses?: Campus[]; showCampusFilter?: boolean; scopeLabel: string; loadError?: string | null };

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString() : '—';

export default function QuizParticipationReport({ students, quizzes, attempts, campuses = [], showCampusFilter = false, scopeLabel, loadError = null }: Props) {
  const [search, setSearch] = useState('');
  const [quizId, setQuizId] = useState('all');
  const [campusId, setCampusId] = useState('all');
  const [status, setStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [view, setView] = useState<'matrix' | 'details'>('matrix');

  const publishedQuizzes = useMemo(() => quizzes.filter(q => q.is_published !== false), [quizzes]);
  const attemptsByKey = useMemo(() => {
    const map = new Map<string, Attempt>();
    for (const attempt of attempts) {
      const key = `${attempt.user_id}:${attempt.challenge_id}`;
      const previous = map.get(key);
      if (!previous || new Date(attempt.completed_at ?? 0).getTime() > new Date(previous.completed_at ?? 0).getTime()) map.set(key, attempt);
    }
    return map;
  }, [attempts]);

  const scopedStudents = useMemo(() => students.filter(student => {
    const name = (student.username || 'Unnamed learner').toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !student.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (showCampusFilter && campusId !== 'all' && student.campus_id !== campusId) return false;
    return true;
  }), [students, search, campusId, showCampusFilter]);

  const scopedQuizzes = useMemo(() => publishedQuizzes.filter(quiz => quizId === 'all' || quiz.id === quizId), [publishedQuizzes, quizId]);
  const getAttempt = (studentId: string, challengeId: string) => attemptsByKey.get(`${studentId}:${challengeId}`);
  const isInDateRange = (attempt: Attempt | undefined) => {
    if (!attempt?.completed_at) return false;
    const timestamp = new Date(attempt.completed_at).getTime();
    if (fromDate && timestamp < new Date(`${fromDate}T00:00:00`).getTime()) return false;
    if (toDate && timestamp > new Date(`${toDate}T23:59:59.999`).getTime()) return false;
    return true;
  };
  const isAttempted = (student: Student, quiz: Quiz) => {
    const attempt = getAttempt(student.id, quiz.id);
    return Boolean(attempt && isInDateRange(attempt));
  };
  const rows = useMemo(() => scopedStudents.flatMap(student => scopedQuizzes.map(quiz => {
    const attempt = getAttempt(student.id, quiz.id);
    const attemptedInRange = isAttempted(student, quiz);
    return { student, quiz, attempt, attemptedInRange };
  })).filter(row => status === 'all' || (status === 'attempted' ? row.attemptedInRange : !row.attemptedInRange)), [scopedStudents, scopedQuizzes, attemptsByKey, status, fromDate, toDate]);
  const matrixStudents = scopedStudents.filter(student => status === 'all' || scopedQuizzes.some(quiz => status === 'attempted' ? isAttempted(student, quiz) : !isAttempted(student, quiz)));
  const attemptedPairs = scopedStudents.reduce((count, student) => count + scopedQuizzes.filter(quiz => isAttempted(student, quiz)).length, 0);
  const totalPairs = scopedStudents.length * scopedQuizzes.length;
  const completionRate = totalPairs ? Math.round(attemptedPairs / totalPairs * 100) : 0;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-zinc-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-mono uppercase tracking-[0.2em] text-emerald-400">Engagement report</p><h2 className="mt-2 text-xl font-semibold">Quiz participation</h2><p className="mt-1 text-sm text-zinc-400">See who attempted each published quiz, with the latest score and completion time. {scopeLabel}</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setView('matrix')} className={`rounded-lg px-3 py-2 text-sm ${view === 'matrix' ? 'bg-emerald-400 font-semibold text-zinc-950' : 'border border-zinc-700 text-zinc-300'}`}>Student matrix</button>
          <button onClick={() => setView('details')} className={`rounded-lg px-3 py-2 text-sm ${view === 'details' ? 'bg-emerald-400 font-semibold text-zinc-950' : 'border border-zinc-700 text-zinc-300'}`}>Detailed rows</button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs text-zinc-400">Students in report</p><p className="mt-2 text-2xl font-semibold">{scopedStudents.length}</p></div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs text-zinc-400">Published quizzes</p><p className="mt-2 text-2xl font-semibold">{scopedQuizzes.length}</p></div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs text-zinc-400">Attempted student/quiz pairs</p><p className="mt-2 text-2xl font-semibold">{attemptedPairs}<span className="ml-1 text-sm font-normal text-zinc-500">/ {totalPairs}</span></p></div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs text-zinc-400">Participation rate</p><p className="mt-2 text-2xl font-semibold text-emerald-300">{completionRate}%</p></div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <label className="text-xs text-zinc-400">Search student<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or account ID" className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-400" /></label>
        {showCampusFilter && <label className="text-xs text-zinc-400">Campus<select value={campusId} onChange={event => setCampusId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"><option value="all">All campuses</option>{campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>}
        <label className="text-xs text-zinc-400">Quiz<select value={quizId} onChange={event => setQuizId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"><option value="all">All published quizzes</option>{publishedQuizzes.map(quiz => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}</select></label>
        <label className="text-xs text-zinc-400">Participation<select value={status} onChange={event => setStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"><option value="all">Attempted + not attempted</option><option value="attempted">Attempted in date range</option><option value="not_attempted">Not attempted in date range</option></select></label>
        <label className="text-xs text-zinc-400">From date<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100" /></label>
        <label className="text-xs text-zinc-400">To date<input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100" /></label>
      </div>
      {loadError && <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">Some report data could not be loaded: {loadError}</p>}

      {publishedQuizzes.length === 0 || scopedStudents.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">{publishedQuizzes.length === 0 ? 'No published quizzes are available for participation tracking yet.' : 'No students match the current filters.'}</div> : view === 'matrix' ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-800"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-zinc-950 text-xs uppercase tracking-wider text-zinc-400"><tr><th className="sticky left-0 bg-zinc-950 px-4 py-3">Student</th>{scopedQuizzes.map(quiz => <th key={quiz.id} className="min-w-40 px-4 py-3"><span className="block max-w-48 normal-case tracking-normal text-zinc-200">{quiz.title}</span><span className="mt-1 block normal-case tracking-normal text-zinc-500">{quiz.subject || 'General'}</span></th>)}</tr></thead><tbody className="divide-y divide-zinc-800">{matrixStudents.map(student => <tr key={student.id} className="hover:bg-zinc-900/70"><td className="sticky left-0 bg-zinc-950 px-4 py-3"><p className="font-medium">{student.username || 'Unnamed learner'}</p><p className="mt-1 font-mono text-[10px] text-zinc-500">{student.id.slice(0, 8)}…</p></td>{scopedQuizzes.map(quiz => { const attempt = getAttempt(student.id, quiz.id); const attempted = isAttempted(student, quiz); return <td key={quiz.id} className="px-4 py-3">{attempted && attempt ? <div><span className="inline-flex rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">Attempted</span><p className="mt-2 text-xs text-zinc-300">Score: {attempt.score ?? '—'} pts</p><p className="mt-1 text-[11px] text-zinc-500">{dateLabel(attempt.completed_at)}</p></div> : <span className="inline-flex rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-200">Not attempted</span>}</td>})}</tr>)}</tbody></table></div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-zinc-800"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-zinc-950 text-xs uppercase tracking-wider text-zinc-400"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score (points)</th><th className="px-4 py-3">Questions</th><th className="px-4 py-3">XP earned</th><th className="px-4 py-3">Completed</th></tr></thead><tbody className="divide-y divide-zinc-800">{rows.slice(0, 2000).map(row => <tr key={`${row.student.id}:${row.quiz.id}`} className="hover:bg-zinc-900/70"><td className="px-4 py-3 font-medium">{row.student.username || 'Unnamed learner'}</td><td className="px-4 py-3">{row.quiz.title}</td><td className="px-4 py-3">{row.attemptedInRange ? <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">Attempted</span> : <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">Not attempted</span>}</td><td className="px-4 py-3 tabular-nums">{row.attemptedInRange ? row.attempt?.score ?? '—' : '—'}</td><td className="px-4 py-3 tabular-nums">{row.attemptedInRange ? row.attempt?.total_questions ?? '—' : '—'}</td><td className="px-4 py-3 tabular-nums">{row.attemptedInRange ? row.attempt?.xp_earned ?? '—' : '—'}</td><td className="px-4 py-3 text-xs text-zinc-400">{row.attemptedInRange ? dateLabel(row.attempt?.completed_at ?? null) : '—'}</td></tr>)}</tbody></table>{rows.length > 2000 && <p className="p-3 text-xs text-zinc-500">Showing first 2,000 matching rows. Narrow filters to inspect more precisely.</p>}</div>
      )}
      <p className="mt-3 text-xs text-zinc-500">“Not attempted” means no recorded attempt for a currently published quiz within the selected date range. The current schema does not retain publication-history timestamps, so historical availability cannot be independently verified. Class-level filtering is not available because the current profile schema has no class field.</p>
    </section>
  );
}

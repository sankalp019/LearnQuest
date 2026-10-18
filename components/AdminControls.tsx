'use client';

import { FormEvent, useEffect, useState } from 'react';

type XpRule = { id: string; action_key: string; label: string; points: number; daily_limit: number | null; enabled: boolean };

export function CampusCreator() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/campuses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create campus.');
      setMessage(`Campus “${result.campus.name}” created. Refresh to see it in the overview.`); setName(''); setCode('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_150px_auto]">
    <label className="text-xs text-zinc-400">Campus name<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={120} placeholder="e.g. HI-Tech Campus" className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></label>
    <label className="text-xs text-zinc-400">Campus code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} required minLength={2} maxLength={20} pattern="[A-Z0-9_-]+" placeholder="HITECH" className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></label>
    <button disabled={busy} className="self-end rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50">{busy ? 'Creating…' : 'Add campus +'}</button>
    {message && <p aria-live="polite" className="text-sm text-emerald-300 sm:col-span-3">{message}</p>}
  </form>;
}

export function XPRulesManager() {
  const [rules, setRules] = useState<XpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => { fetch('/api/admin/xp-rules').then(async r => { const d=await r.json(); if(!r.ok) throw new Error(d.error); setRules(d.rules ?? []); }).catch(e=>setMessage(e.message || 'Could not load XP rules. Apply the latest database migration.')).finally(()=>setLoading(false)); }, []);
  function update(id: string, patch: Partial<XpRule>) { setRules(current=>current.map(rule=>rule.id===id?{...rule,...patch}:rule)); }
  async function save(rule: XpRule) {
    setSaving(rule.id); setMessage('');
    try { const response=await fetch('/api/admin/xp-rules',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(rule)}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setMessage(`Saved ${rule.label}. Changes are recorded in the audit log.`); }
    catch(e) { setMessage(e instanceof Error?e.message:'Could not save rule.'); }
    finally { setSaving(null); }
  }
  return <div>
    {loading ? <p className="text-sm text-zinc-400">Loading XP rules…</p> : rules.length===0 ? <p className="text-sm text-zinc-400">No rules available. Apply the LearnQuest operations migration to initialize the points economy.</p> : <div className="space-y-3">{rules.map(rule=><div key={rule.id} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto_auto] sm:items-center">
      <div><p className="font-medium text-zinc-100">{rule.label}</p><p className="mt-1 font-mono text-[11px] text-zinc-500">{rule.action_key}</p></div>
      <label className="text-xs text-zinc-400">XP points<input type="number" min={0} max={1000} value={rule.points} onChange={e=>update(rule.id,{points:Number(e.target.value)})} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white" /></label>
      <label className="text-xs text-zinc-400">Daily limit<input type="number" min={1} max={1000} placeholder="No limit" value={rule.daily_limit ?? ''} onChange={e=>update(rule.id,{daily_limit:e.target.value===''?null:Number(e.target.value)})} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white" /></label>
      <label className="flex items-center gap-2 self-center text-sm text-zinc-300"><input type="checkbox" checked={rule.enabled} onChange={e=>update(rule.id,{enabled:e.target.checked})} className="accent-emerald-400"/> Enabled</label>
      <button onClick={()=>save(rule)} disabled={saving===rule.id} className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50">{saving===rule.id?'Saving…':'Save rule'}</button>
    </div>)}</div>}
    {message && <p aria-live="polite" className="mt-4 text-sm text-emerald-300">{message}</p>}
  </div>;
}

export function AccountRoleControl({ userId, initialRole }: { userId: string; initialRole: string }) {
  const [role, setRole] = useState(initialRole);
  const [savedRole, setSavedRole] = useState(initialRole);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role, reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Role update failed.');
      setMessage('Saved'); setSavedRole(role); setReason('');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Role update failed.'); }
    finally { setBusy(false); }
  }
  return <div className="min-w-[205px] space-y-1.5">
    <div className="flex items-center gap-2"><select aria-label="Account role" value={role} onChange={e=>setRole(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"><option value="student">Student</option><option value="teacher">Faculty / Teacher</option><option value="campus_admin">Admin</option><option value="super_admin">Superadmin</option></select><button onClick={save} disabled={busy||role===savedRole||(role!==savedRole&&!reason.trim())} className="rounded-md bg-emerald-400 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-40">{busy?'…':'Save'}</button></div>
    {role!==savedRole && <input aria-label="Reason for role change" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for change (audit)" className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300" />}
    {message && <p className={`text-[11px] ${message==='Saved'?'text-emerald-300':'text-amber-300'}`}>{message}</p>}
  </div>;
}

const starterQuestionBank = JSON.stringify([
  { question_text: 'Which data structure follows FIFO order?', options: ['Stack', 'Queue', 'Tree', 'Graph'], correct_answer: 'Queue', points: 10, explanation: 'A queue removes items in first-in, first-out order.' },
  { question_text: 'Which complexity describes binary search on a sorted array?', options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'], correct_answer: 'O(log n)', points: 10, explanation: 'Binary search halves the remaining search space each step.' },
  { question_text: 'Which keyword declares a block-scoped variable in JavaScript?', options: ['var', 'function', 'global', 'let'], correct_answer: 'let', points: 10, explanation: 'let declares a variable scoped to its enclosing block.' },
], null, 2);

export function ChallengeCreator() {
  const [title,setTitle]=useState(''); const [subject,setSubject]=useState('Programming'); const [description,setDescription]=useState('');
  const [difficulty,setDifficulty]=useState('Easy'); const [xpReward,setXpReward]=useState(50); const [published,setPublished]=useState(false); const [bank,setBank]=useState(starterQuestionBank);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    let questions: unknown;
    try { questions=JSON.parse(bank); if(!Array.isArray(questions)) throw new Error('Question bank must be a JSON array.'); }
    catch(e) { setBusy(false); setMessage(e instanceof Error?e.message:'Invalid JSON question bank.'); return; }
    try {
      const response=await fetch('/api/faculty/challenges',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,subject,description,difficulty,xp_reward:xpReward,is_published:published,questions})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||'Could not create activity.');
      setMessage(`Created ${title} with ${data.result.question_count} questions${published?' and published it': ' as a draft'}. Refresh the activity list to see it.`); setTitle('');
    } catch(e) { setMessage(e instanceof Error?e.message:'Could not create activity.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs text-zinc-400">Quiz title<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3} maxLength={120} placeholder="e.g. Data Structures — Daily Quest" className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></label><label className="text-xs text-zinc-400">Subject<input value={subject} onChange={e=>setSubject(e.target.value)} required minLength={2} maxLength={80} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></label></div>
    <label className="block text-xs text-zinc-400">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} maxLength={2000} placeholder="What should learners practise?" className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400" /></label>
    <div className="grid gap-4 sm:grid-cols-3"><label className="text-xs text-zinc-400">Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white"><option>Easy</option><option>Medium</option><option>Hard</option></select></label><label className="text-xs text-zinc-400">XP reward<input type="number" min={0} max={500} value={xpReward} onChange={e=>setXpReward(Number(e.target.value))} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><label className="flex items-center gap-2 self-end pb-3 text-sm text-zinc-300"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)} className="accent-emerald-400"/> Publish immediately</label></div>
    <label className="block text-xs text-zinc-400">Question bank (JSON) <span className="text-zinc-600">· 3–20 questions, four options and one correct answer each</span><textarea value={bank} onChange={e=>setBank(e.target.value)} rows={12} spellCheck={false} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-xs leading-5 text-emerald-100 outline-none focus:border-emerald-400" /></label>
    <div className="flex flex-wrap items-center gap-3"><button disabled={busy} className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50">{busy?'Creating…':'Create question bank'}</button><p className="text-xs text-zinc-500">Correct answers are stored separately from the student-facing question bank.</p></div>
    {message && <p aria-live="polite" className="text-sm text-emerald-300">{message}</p>}
  </form>;
}

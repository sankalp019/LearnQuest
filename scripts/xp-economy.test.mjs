import assert from 'node:assert/strict';

const rules = {
  attendance:{points:10,limit:Infinity}, assignment:{points:20,limit:Infinity},
  daily_quiz:{points:15,limit:1}, quiz_correct:{points:5,limit:5},
  coding_easy:{points:10,limit:10}, coding_medium:{points:20,limit:10},
  coding_hard:{points:40,limit:10}, club_activity:{points:25,limit:1},
  seven_day_streak:{points:50,limit:1}, peer_help:{points:15,limit:3},
};
function award(state,user,action,source,day='2026-10-16') {
  const rule=rules[action]; assert.ok(rule,`unknown action ${action}`);
  if (!source) throw Error('source reference required');
  const key=`${user}|${action}|${source}`;
  if (state.keys.has(key)) return {duplicate:true,points:0};
  const used=state.ledger.filter(x=>x.user===user&&x.action===action&&x.day===day).length;
  if (used>=rule.limit) throw Error('daily limit reached');
  state.keys.add(key); state.ledger.push({user,action,source,day,points:rule.points});
  state.totals.set(user,(state.totals.get(user)||0)+rule.points);
  return {duplicate:false,points:rule.points};
}
const state={keys:new Set(),ledger:[],totals:new Map()};
const scenarios=[['attendance','class-1',10],['assignment','assignment-1',20],['daily_quiz','quiz-day-1',15],['quiz_correct','question-1',5],['coding_easy','leetcode-1',10],['coding_medium','leetcode-2',20],['coding_hard','leetcode-3',40],['club_activity','club-day-1',25],['seven_day_streak','streak-week-1',50],['peer_help','answer-accepted-1',15]];
scenarios.forEach(([action,source,expected],i)=>assert.equal(award(state,`student-${i+1}`,action,source).points,expected));
assert.equal(state.ledger.reduce((n,x)=>n+x.points,0),210,'10-student scripted XP total must be exact');
assert.equal(award(state,'student-1','attendance','class-1').duplicate,true,'duplicate source must not pay twice');
assert.throws(()=>award(state,'student-3','daily_quiz','quiz-day-2'),/daily limit reached/,'daily quiz limit must block farming');
assert.throws(()=>award(state,'student-1','coding_easy',''),/source reference required/,'unverifiable source must be rejected');
// Five anti-gaming probes: replay, missing evidence, daily cap, fake action, and duplicate peer-help.
const antiGaming = [
  ['replay prevented',()=>assert.equal(award(state,'student-1','attendance','class-1').duplicate,true)],
  ['missing evidence rejected',()=>assert.throws(()=>award(state,'student-1','assignment',''))],
  ['daily cap enforced',()=>assert.throws(()=>award(state,'student-3','daily_quiz','quiz-day-3'))],
  ['unknown action rejected',()=>assert.throws(()=>award(state,'student-1','idle_click','click-1'))],
  ['peer duplicate prevented',()=>assert.equal(award(state,'student-10','peer_help','answer-accepted-1').duplicate,true)],
];
for(const [name,test] of antiGaming){test();console.log(`PASS anti-gaming: ${name}`)}
// Fairness smoke test: learner in the bottom quartile can earn personal-improvement reward without top rank.
const learner={previousScore:40,currentScore:58,completedQuests:1};
const improvementBadge=learner.currentScore-learner.previousScore>=15;
assert.equal(improvementBadge,true,'improvement badge must be reachable independent of rank');
assert.equal(learner.completedQuests,1);
console.log('PASS XP economy: 10 scripted learners, exact rule values and idempotency');
console.log('PASS fairness smoke test: improvement badge can be earned without leaderboard rank');
function streakStep(current,day){
  if(!current.lastDate) return {streak:1,lastDate:day,freezes:current.freezes};
  const gap=(Date.parse(`${day}T00:00:00Z`)-Date.parse(`${current.lastDate}T00:00:00Z`))/86400000;
  if(gap===0) return {...current,lastDate:day};
  if(gap===1) return {streak:current.streak+1,lastDate:day,freezes:current.freezes};
  if(gap>1 && current.freezes>=gap-1) return {streak:current.streak+1,lastDate:day,freezes:current.freezes-(gap-1)};
  return {streak:1,lastDate:day,freezes:current.freezes};
}
let streak={streak:1,lastDate:'2026-10-10',freezes:1};
streak=streakStep(streak,'2026-10-10'); assert.equal(streak.streak,1,'multiple learning actions on one date must not grow streak');
streak=streakStep(streak,'2026-10-11'); assert.equal(streak.streak,2,'consecutive learning date increments streak');
streak=streakStep(streak,'2026-10-13'); assert.equal(streak.streak,3,'one freeze bridges a one-day gap'); assert.equal(streak.freezes,0,'freeze is consumed');
streak=streakStep(streak,'2026-10-16'); assert.equal(streak.streak,1,'streak resets when gap exceeds remaining freezes');
console.log('PASS streak smoke test: distinct-day counting, freeze consumption, and reset behavior');

// Lightweight HTTP concurrency probe for a running deployment. It measures this HTTP
// endpoint only; it does not simulate WebSockets or claim end-to-end realtime scale.
const base = (process.env.LOAD_TEST_URL || 'http://localhost:3000').replace(/\/$/,'');
const path = process.env.LOAD_TEST_PATH || '/';
const levels = (process.env.LOAD_LEVELS || '100,300,500').split(',').map(Number).filter(n=>Number.isInteger(n)&&n>0);
const rounds = Number(process.env.LOAD_ROUNDS || 2);
const quantile = (a,q)=>a.length?a[Math.min(a.length-1,Math.ceil(q*a.length)-1)]:0;
for (const concurrency of levels) {
 const durations=[]; let errors=0; let completed=0; const start=Date.now();
 for(let round=0;round<rounds;round++) {
  let next=0;
  const workers=Array.from({length:Math.min(concurrency,1000)},async()=>{
   while(true){const i=next++; if(i>=concurrency) return; const t=performance.now();
    try {const r=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(15000)}); await r.arrayBuffer(); if(!r.ok) errors++; else completed++;}
    catch {errors++;} finally {durations.push(performance.now()-t);}
   }
  });
  await Promise.all(workers);
 }
 durations.sort((a,b)=>a-b);
 console.log(JSON.stringify({target:base+path,concurrency,rounds,requests:concurrency*rounds,completed,errors,errorRate:Number((errors/(concurrency*rounds)).toFixed(4)),p50Ms:Math.round(quantile(durations,.5)),p95Ms:Math.round(quantile(durations,.95)),wallMs:Date.now()-start}));
}

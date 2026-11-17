// Autoland test: every runway end at every airport flown from 5 nm out with the autopilot (AP + A/THR + APP) in a 12 kt
// crosswind, plus Istanbul 16R in gusty wind. Each must land on the runway and stop; prints sink rate, touchdown distance from
// the threshold, centreline offset and crab at touchdown. Usage: node test/landing-test.js  (after python3 test/mkharness.py)
const H=require('./harness.js');
const DT=1/60;
function fly(end,scen){
  H.setScen(scen);H.setMission('approach');H.setTarget(end);H.resetFlight();
  H.ac.gear=1;H.ac.flaps=2;   // the approach starts clean: gear down and flaps 30, as a pilot would
  if(H.ap.on)H.apMode('AP');H.apMode('AP');H.apMode('APP');if(!H.ap.athr)H.apMode('ATHR');H.ap.sel.ias=Math.round(H.vref());
  for(let t=0;t<600&&!H.result();t+=DT){H.step(DT);const n=Math.max(2,Math.ceil(DT/0.006));for(let i=0;i<n&&H.ac.phase==='fly'&&!H.result();i++)H.flyStep(DT/n);}
  return H.result();}
const SC=['calm','xwind','gusty'];let pass=0,fail=0;
const runs=[];for(const ap of H.AIRPORTS)for(const e of ap.ends)runs.push([e,1]);
const ist=H.AIRPORTS.flatMap(a=>a.ends).find(e=>e.id==='IST 16R'||/^IST/.test(e.id)&&/16R/.test(e.id));if(ist)runs.push([ist,2]);
for(const[e,s]of runs){const r=fly(e,s),td=r&&r.td;
  const ok=r&&r.ok&&td&&td.onRwy;ok?pass++:fail++;
  console.log((e.id+' '+SC[s]+':').padEnd(18),ok?'LANDED':'FAILED',td?`vs=${Math.round(td.vsFpm)} td=${Math.round(td.dist)}m x=${td.x.toFixed(1)} crab=${(td.crab||0).toFixed(1)}`:'',r&&!r.ok?'('+r.why+')':'',r?'':'(no result in 600 s)');}
console.log(`\n${pass} landed, ${fail} failed`);process.exitCode=fail?1:0;

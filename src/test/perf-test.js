// Performance checks for the flight model, flown through the real physics: top level speed at sea level and at 10 km (full
// thrust, autopilot holding altitude), the fly-by-wire g limit in a full pull at 400 kt, the angle-of-attack limiter in a full
// pull at low speed (no stall), roll rate at high and low speed, approach speed changing with fuel weight, a thrust-vectoring Cobra and hanging nose-up at zero speed. Each result
// must fall in a sensible band for a 5.8 t aircraft with a 10,000 lbf engine. Usage: node test/perf-test.js
const H=require('./harness.js'),THREE=require(process.env.THREE_CJS||'/Users/barishiz/Desktop/hair dresser/node_modules/three/build/three.cjs');const DT=1/120,KT=0.5144,DEG=Math.PI/180;
const a=H.ac;const tick=s=>{for(let i=0;i<Math.round(s/DT);i++){H.step(DT);H.flyStep(DT/2);H.flyStep(DT/2);if(a.phase!=='fly')return false;}return true;};
// clean aircraft in level flight at height h (m) and true speed V (m/s), 3,000 lb of fuel, near an airport of the given end id
function setup(end,h,V,fuel=3000){const e=H.AIRPORTS.flatMap(x=>x.ends).find(x=>x.id===end);H.setScen(0);H.setMission('approach');H.setTarget(e);H.resetFlight();
  if(H.ap.on)H.apMode('AP');a.gear=0;a.gearT=0;a.flaps=0;a.fuel=fuel;H.setAutoTrim(true);
  a.pos.y=h;a.V=V;a.gamma=0;a.phi=0;a.p=a.q=a.r=0;a.beta=0;const rho=H.isa(h).rho,cl=H.acMass()*9.81/(0.5*rho*V*V*H.AC.S);a.alpha=cl/H.AC.clA+H.AC.a0;a.theta=a.alpha;
  a.trim=(a.alpha-H.PM.a0)*H.PM.ka/H.PM.kd;a.va.set(Math.sin(a.psiB),0,-Math.cos(a.psiB)).multiplyScalar(V);a.pOm=null;H.sync();H.inp.pitch=0;H.inp.roll=0;}
const nz=()=>{const at=H.isa(a.pos.y);return 0.5*at.rho*a.V*a.V*H.AC.S*H.CL(a.alpha,a.flaps)/(H.acMass()*9.81);};
const rows=[];let fail=0;const check=(name,val,lo,hi,unit,dec=1)=>{const ok=val>=lo&&val<=hi;if(!ok)fail++;rows.push(`${ok?'ok  ':'FAIL'} ${name.padEnd(44)} ${val.toFixed(dec).padStart(7)} ${unit.padEnd(6)} (expected ${lo}–${hi})`);};
// 1. top level speed, dry (throttle at the 90 % detent) and in full afterburner, autopilot holding altitude, until it stops accelerating
for(const[thr,h,lo,hi,label]of[[90,600,0.84,0.97,'dry, sea level (600 m)'],[90,10000,0.80,0.97,'dry, 10 km'],[100,600,0.98,1.15,'afterburner, sea level'],[100,10000,1.10,1.50,'afterburner, 10 km']]){
  setup('IST 16R',h,thr>90?260:200);H.apMode('AP');H.apMode('ALT');if(H.ap.athr)H.apMode('ATHR');H.setThrottle(thr);
  tick(240);const m0=a.mach;tick(30);check('top level speed, '+label,a.mach,lo,hi,'Mach',3);
  rows.push(`     change in the last 30 s ${(a.mach-m0).toFixed(3)} Mach; ${Math.round(a.V/KT)} kt true, ${Math.round(a.ias)} kt indicated, thrust ${Math.round(a.thrN/4.448)} lbf, fuel flow ${Math.round(H.sim.ff)} pph`);}
// afterburner fuel burn: full afterburner burns about three to five times the fuel of full dry power
{setup('IST 16R',600,200);H.setThrottle(90);tick(20);const dry=H.sim.ff;H.setThrottle(100);tick(20);check('fuel flow, full afterburner ÷ full dry power',H.sim.ff/dry,3,5.5,'×');}
// 2. full pull at 400 kt, 3 km: the g limiter holds about 9 g
setup('ESB 03R',3000,400*KT);H.setThrottle(100);tick(2);let mx=0;H.inp.pitch=1;for(let i=0;i<300;i++){tick(0.01);mx=Math.max(mx,nz());}H.inp.pitch=0;
check('peak load factor, full pull at 400 kt',mx,8.3,9.4,'g');
// 3. full pull at 170 kt: the angle-of-attack limiter stops short of the stall
setup('ESB 03R',3000,170*KT);H.setThrottle(100);tick(2);let amx=0,stalled=false;H.inp.pitch=1;for(let i=0;i<500;i++){tick(0.01);amx=Math.max(amx,a.alpha);stalled=stalled||a.stalled;}H.inp.pitch=0;
check('peak AoA, full pull at 170 kt (stall 24°)',amx/DEG,15,23.5,'°');rows.push(`     stalled: ${stalled?'YES':'no'}`);if(stalled)fail++;
// 4. roll rate: full stick for 1.5 s
for(const[kt,lo,hi]of[[400,170,240],[170,40,110]]){setup('ESB 03R',3000,kt*KT);H.setThrottle(80);tick(1);let pm=0;H.inp.roll=1;for(let i=0;i<150;i++){tick(0.01);pm=Math.max(pm,Math.abs(a.p));}H.inp.roll=0;
  check(`peak roll rate, full stick at ${kt} kt`,pm/DEG,lo,hi,'°/s',0);}
// 5. weight follows fuel: approach speed with full tanks vs nearly empty
setup('ESB 03R',2000,80);a.flaps=2;a.fuel=6000;const vFull=H.vref();a.fuel=1500;const vLow=H.vref();
check('Vref, flaps 30, 6,000 lb fuel',vFull,135,160,'kt',0);check('Vref, flaps 30, 1,500 lb fuel',vLow,118,140,'kt',0);
// 6. Cobra in post-stall mode (thrust vectoring): 230 kt at 3 km in full afterburner. The stick commands pitch rate, so the pull is
// a steady rotation; let go at about 80° nose-up and the attitude holds; push and the nose comes back down. Checked: peak AoA, height
// change, speed lost, how far the nose runs on after release, how steady it then stays, and how fast a push brings the AoA back.
const nose=()=>Math.asin(new THREE.Vector3(0,0,-1).applyQuaternion(a.Q).y)/DEG;
function pstSetup(kt){setup('ESB 03R',3000,kt*KT);H.setThrottle(100);tick(12);a.pos.y=3000;a.V=kt*KT;a.gamma=0;a.psi=a.psiB;a.theta=a.alpha;a.q=0;a.va.set(Math.sin(a.psiB),0,-Math.cos(a.psiB)).multiplyScalar(a.V);a.pOm=null;H.sync();tick(0.5);}
{pstSetup(230);const y0=a.pos.y,v0=a.V;H.setPst(true);let amx=0,vmin=a.V,dh=0,rel=null,nRel=0,nMax=-90,hold=[],push=null,rec=null;
  for(let i=0;i<600;i++){const t=i/100;
    if(rel==null){H.inp.pitch=1;if(nose()>72){rel=t;nRel=nose();H.inp.pitch=0;}}
    else if(t<rel+2){H.inp.pitch=0;if(t>rel+0.8)hold.push(nose());}
    else{if(push==null)push=t;H.inp.pitch=a.alpha>15*DEG?-1:0;if(rec==null&&a.alpha<20*DEG)rec=t-push;}
    tick(0.01);amx=Math.max(amx,a.alpha);vmin=Math.min(vmin,a.V);if(rel!=null)nMax=Math.max(nMax,nose());if(push==null)dh=Math.max(dh,Math.abs(a.pos.y-y0));}
  H.setPst(false);H.inp.pitch=0;
  check('Cobra: peak AoA (post-stall mode, TVC)',amx/DEG,65,110,'°',0);check('Cobra: height change up to the push',dh,0,150,'m',0);
  check('Cobra: speed lost',(v0-vmin)/KT,50,180,'kt',0);check('Cobra: nose runs on after the stick is released',nMax-nRel,0,20,'°',1);
  check('Cobra: nose wander while held (stick free)',Math.max(...hold)-Math.min(...hold),0,4,'°',1);check('Cobra: push brings AoA below 20°',rec==null?99:rec,0,1.5,'s',1);}
// 7. hanging at zero speed: pull to vertical, let go, and trim thrust (a simple pilot on the throttle) for zero vertical speed. The
// nose should stay put while the airspeed bleeds away and the aircraft hangs on its thrust
{pstSetup(180);H.setPst(true);let done=false,I=0;const ns=[],vs=[],hs=[];
  for(let i=0;i<2500;i++){const t=i/100,n=nose();if(n>86||(a.q<0&&t>0.5))done=true;H.inp.pitch=done?0:Math.max(0,Math.min(1,(90-n)/25));
    if(done){I+=-a.vs*0.4*0.01;H.setThrottle(Math.max(85,Math.min(100,95+I-1.2*a.vs)));}
    tick(0.01);if(a.phase!=='fly')break;if(t>20){ns.push(n);vs.push(Math.abs(a.vs));hs.push(a.V/KT);}}
  H.setPst(false);H.setThrottle(80);
  check('Hang: nose attitude change over the last 5 s',ns.length?Math.max(...ns)-Math.min(...ns):99,0,2,'°',1);check('Hang: airspeed at the end',hs.length?hs[hs.length-1]:999,0,35,'kt',0);
  check('Hang: worst vertical speed over the last 5 s',vs.length?Math.max(...vs):99,0,2.5,'m/s',1);}
console.log(rows.join('\n'));console.log(`\n${fail?fail+' check(s) failed':'all checks passed'}`);process.exitCode=fail?1:0;

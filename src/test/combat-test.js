// Air-combat checks, run through the game's own radar, missile and target-aircraft code: the launch zone against real fly-outs
// (a target that holds its course is hit from inside Rmax and not from well beyond it, high and low), a defending target (beam,
// dive, chaff) that is nearly always hit inside the no-escape range but escapes most shots fired near Rmax, the radar cone and
// the Doppler notch, and the Intercept mission's start. Usage: node test/combat-test.js
const H=require('./harness.js'),THREE=require(process.env.THREE_CJS||'/Users/barishiz/Desktop/hair dresser/node_modules/three/build/three.cjs');
const DEG=Math.PI/180,a=H.ac,C=H.CMB,NM=H.NM,DT=1/120;
const rows=[];let fail=0;const check=(name,val,lo,hi,unit,dec=1)=>{const ok=val>=lo&&val<=hi;if(!ok)fail++;rows.push(`${ok?'ok  ':'FAIL'} ${name.padEnd(58)} ${(typeof val==='number'?val.toFixed(dec):String(val)).padStart(7)} ${unit.padEnd(5)} (expected ${lo}–${hi})`);};
// own aircraft in straight flight at height h; one target at range R nm ahead at height th, flying towards (hot), away (cold) or across (beam)
function setup(h,V){H.setScen(0);const e=H.AIRPORTS.flatMap(x=>x.ends).find(x=>x.id==='ESB 03R');H.setTarget(e);H.setMission('approach');H.resetFlight();
  a.pos.set(0,h,0);a.V=V;a.psi=a.psiB=0;a.theta=2*DEG;a.phi=0;a.gamma=0;a.va.set(0,0,-V);a.pOm=null;H.sync();H.combatReset(true);}
function target(R,th,aspect,tV,passive){const b=H.mkBandit('T',new THREE.Vector3(0,th,-R*NM),aspect==='hot'?Math.PI:aspect==='cold'?0:Math.PI/2,tV);b.passive=passive;if(passive)b.state='none';C.bandits.push(b);return b;}
const run=s=>{for(let t=0;t<s;t+=DT){a.pos.addScaledVector(a.va,DT);H.combatStep(DT);}};
function shot({h=7600,V=270,R,th,aspect='hot',tV=270,passive=true,seed=1}){setup(h,V);C.seed=seed*7919+13;const b=target(R,th==null?h:th,aspect,tV,passive);C.lock=b;C.lockInfo=H.radarLook(b);C.dlz=H.dlzCalc();
  const d=C.dlz,m=H.fireMissile();let t=0;while(m.alive&&t<110){a.pos.addScaledVector(a.va,DT);H.combatStep(DT);t+=DT;}return {d,res:m.res,t};}
// 1. launch zone and real fly-outs against a target holding its course
{const z=shot({R:20});check('Rmax, head-on at 25,000 ft, both at 525 kt',z.d.rmax/NM,32,48,'nm');check('Rne (no-escape), same',z.d.rne/NM,9,20,'nm');
  const R=z.d.rmax/NM;check('head-on shot at 0.9 × Rmax: hit',shot({R:0.9*R}).res==='kill'?1:0,1,1,'');check('head-on shot at 1.3 × Rmax: no hit',shot({R:1.3*R}).res==='kill'?0:1,1,1,'');
  const lo=shot({h:1500,R:5});check('Rmax, head-on at 5,000 ft',lo.d.rmax/NM,15,34,'nm');const Rl=lo.d.rmax/NM;
  check('low shot at 0.85 × Rmax: hit',shot({h:1500,R:0.85*Rl}).res==='kill'?1:0,1,1,'');check('low shot at 1.4 × Rmax: no hit',shot({h:1500,R:1.4*Rl}).res==='kill'?0:1,1,1,'');
  const co=shot({R:6,aspect:'cold'});check('Rmax against a target flying away is short',co.d.rmax/NM,5,16,'nm');check('tail shot at 0.75 × that Rmax: hit',shot({R:0.75*co.d.rmax/NM,aspect:'cold'}).res==='kill'?1:0,1,1,'');}
// 2. a defending target: inside the no-escape range it rarely gets away; near Rmax it usually does
{const ne=shot({R:20}).d.rne/NM;let kIn=0,kOut=0;for(let s=1;s<=6;s++){if(shot({R:0.8*ne,passive:false,seed:s}).res==='kill')kIn++;if(shot({R:1.4*ne,passive:false,seed:s}).res==='kill')kOut++;}
  check('defending target (beam, dive, chaff), shots at 0.8 × Rne: hits of 6',kIn,5,6,'',0);check('defending target, shots at 1.4 × Rne: hits of 6',kOut,0,3,'',0);}
// 3. radar: the ±60° cone, and the Doppler notch (a target crossing below the horizon is lost in the ground clutter)
{setup(7600,270);const b=target(20,7600,'hot',270,true);b.pos.z=20*NM;H.lockNext();check('target behind: no lock',C.lock?0:1,1,1,'');
  setup(7600,270);const n=target(15,3000,'beam',270,true);H.lockNext();check('low crossing target (notch): no lock',C.lock?0:1,1,1,'');
  setup(7600,270);const h=target(15,3000,'hot',270,true);H.lockNext();check('low target coming head-on: lock',C.lock?1:0,1,1,'');
  h.psi=Math.PI/2;run(3);check('the same target turns to beam: lock broken within 3 s',C.lock?0:1,1,1,'');}
// 4. the Intercept mission: three bandits 36–44 nm ahead, own aircraft at about 20,000 ft with four missiles
{H.setScen(0);const e=H.AIRPORTS.flatMap(x=>x.ends).find(x=>x.id==='IST 16R');H.setTarget(e);H.setMission('intercept');H.resetFlight();
  const f=new THREE.Vector3(Math.sin(a.psiB),0,-Math.cos(a.psiB));const ds=C.bandits.map(b=>b.pos.clone().sub(a.pos).dot(f)/NM);
  check('Intercept: bandits',C.bandits.length,3,3,'',0);check('Intercept: nearest bandit ahead',Math.min(...ds),34,46,'nm');check('Intercept: own height',a.alt,19000,21000,'ft',0);
  check('Intercept: missiles on the rails',C.stores,4,4,'',0);
  // fly the real aircraft for 20 s with the stick centred: it should hold its height (it starts trimmed, at cruise power)
  const y0=a.pos.y;for(let t=0;t<20;t+=DT){H.step(DT);H.flyStep(DT/2);H.flyStep(DT/2);H.combatStep(DT);}check('Intercept: height change in the first 20 s, hands off',Math.abs(a.pos.y-y0),0,150,'m',0);
  H.setMission('approach');}
console.log(rows.join('\n'));console.log(`\n${fail?fail+' check(s) failed':'all checks passed'}`);process.exitCode=fail?1:0;

/* ================= Air combat: radar, missiles and target aircraft =================
   Modelled on how beyond-visual-range fights work in DCS World. The fire-control radar searches a ±60° cone out to about 42 nm
   and can hold one hard lock (single-target track). A target flying across the beam below the horizon has almost no Doppler
   shift and hides in the ground clutter (the "notch"), so the radar loses it. The missile is AIM-120-like: a 7.5 s rocket motor,
   drag that grows with air density and Mach and with every hard turn, a lofted climb on long shots, and proportional-navigation
   steering. The aircraft guides it over a data link while the lock holds; at about 9 nm it turns its own radar on ("pitbull")
   and from then on it hunts by itself. The proximity fuze fires within 15 m. Targets that get a launch warning (a launch while
   hard-locked) or see the missile's radar turn 90° to it, dive and drop chaff, which can seduce a missile that is notched.
   Everything here is plain physics with no drawing, so the tests can run it. */
// <combat-sim>
const NM=1852;
const AMR={m0:152,mb:102,tb:7.5,A:0.034,vDead:230,Sl:0.4,gMax:40,Isp:245,arm:1.5,fuze:15,kill:9,life:90,pit:9*NM,seekFov:30*DEG,seekR:22000,N:4};
AMR.mdot=(AMR.m0-AMR.mb)/AMR.tb;AMR.T=AMR.Isp*9.81*AMR.mdot;
// four launch rails: right, up and aft of the CG in metres (under the wings, outboard pair first)
const CMB_STA=[[-3.55,-0.34,1.2],[3.55,-0.34,1.2],[-2.35,-0.5,0.5],[2.35,-0.5,0.5]];
const CMB={on:false,bandits:[],msls:[],decoys:[],contacts:[],lock:null,lockInfo:null,notchT:0,stores:4,st:[1,1,1,1],fired:0,kills:0,seed:12345,t:0,scanT:0,dlz:null,allDown:false,
  radar:{range:42*NM,gim:60*DEG},rnd(){this.seed=(this.seed*16807)%2147483647;return this.seed/2147483647;}};
const _cm=[0,1,2,3,4,5,6,7,8].map(()=>new THREE.Vector3());
let cmbMsg=(t,cls)=>{onEvent(t,cls||'warn');};
let cmbBoom=()=>{};   // explosion effect hook, set by the view code
function amrCd(M,burn){const c=M<0.9?0.32:M<1.2?0.32+0.4*(M-0.9)/0.3:0.72*pow(1.2/M,0.55);return burn?c*0.8:c;}
function banditVel(b){return b.vel.set(sin(b.psi)*cos(b.gam),sin(b.gam),-cos(b.psi)*cos(b.gam)).multiplyScalar(b.V);}
function mkBandit(name,pos,psi,V){const b={name,isBandit:true,pos:pos.clone(),vel:new THREE.Vector3(),psi,gam:0,phi:0,V,V0:V,alt0:pos.y,alive:true,deadT:0,ground:false,spin:0,
  state:'patrol',psiC:psi,altC:pos.y,Vc:V,gLim:2.5,chaff:40,chaffT:0,quiet:0};banditVel(b);return b;}
function combatReset(on){Object.assign(CMB,{on,bandits:[],msls:[],decoys:[],contacts:[],lock:null,lockInfo:null,notchT:0,stores:4,st:[1,1,1,1],fired:0,kills:0,t:0,scanT:0,dlz:null,allDown:false,seed:12345});}
// three bandits 36-44 nm ahead, spread across 13 nm and three heights, flying towards the aircraft
function spawnBandits(){const f=_cm[0].set(sin(ac.psiB),0,-cos(ac.psiB)),r=_cm[1].set(cos(ac.psiB),0,sin(ac.psiB));
  [[36,-6,5000,210],[40,1,7300,225],[44,7,9200,235]].forEach(([d,l,h,v],i)=>{const p=ac.pos.clone().addScaledVector(f,d*NM).addScaledVector(r,l*NM);p.y=gnd(p.x,p.z)+h;
    CMB.bandits.push(mkBandit('B'+(i+1),p,ac.psiB+PI+(CMB.rnd()-0.5)*0.2,v));});}
// ---------- target aircraft: patrol, commit towards the aircraft, and defend against missiles they know about ----------
function banditStep(b,dt){
  if(!b.alive){b.deadT+=dt;if(!b.ground){b.gam=max(b.gam-0.45*dt,-1.2);b.phi+=b.spin*dt;b.V=max(90,b.V-6*dt);banditVel(b);b.pos.addScaledVector(b.vel,dt);
      const gy=gnd(b.pos.x,b.pos.z);if(b.pos.y<gy+3){b.ground=true;b.pos.y=gy+1;cmbBoom(b.pos,2.2,true);}}return;}
  const toMe=_cm[2].copy(ac.pos).sub(b.pos),R=toMe.length();
  // the nearest missile it knows about: launch warning while hard-locked, or the missile's own radar once it has gone active
  let thr=null,td=1e12;for(const m of CMB.msls){if(!m.alive||m.warn==null||CMB.t<m.warn)continue;if(m.tgt!==b&&m.seek!==b)continue;const d=m.pos.distanceToSquared(b.pos);if(d<td){td=d;thr=m;}}
  if(b.passive){}   // test target: holds its course and ignores missiles
  else if(thr){if(b.state!=='defend')b.altD=max(gnd(b.pos.x,b.pos.z)+900,b.pos.y-2500);b.state='defend';b.quiet=0;const l=_cm[3].copy(b.pos).sub(thr.pos);const a=Math.atan2(l.x,-l.z),c1=a+PI/2,c2=a-PI/2;
    b.psiC=abs(wrapPI(c1-b.psi))<abs(wrapPI(c2-b.psi))?c1:c2;b.altC=b.altD;b.Vc=290;b.gLim=7;
    if(Math.sqrt(td)<14000&&CMB.t>b.chaffT&&b.chaff>0){b.chaffT=CMB.t+0.7+CMB.rnd()*0.4;b.chaff--;
      const dc={isDecoy:true,pos:b.pos.clone(),vel:b.vel.clone().multiplyScalar(0.15),t0:CMB.t};CMB.decoys.push(dc);
      // chaff seduces an active seeker that sees the target notched (little Doppler) far more often than one that does not
      for(const m of CMB.msls){if(!m.alive||!m.active||m.seek!==b)continue;const lm=_cm[4].copy(b.pos).sub(m.pos).normalize();const notch=abs(b.vel.dot(lm))<55;
        if(CMB.rnd()<(notch?0.08:0.015)){m.seek=dc;m.decT=CMB.t;}}}}
  else{if(b.state==='defend'){b.quiet+=dt;if(b.quiet>4)b.state='commit';}
    if(b.state==='patrol'&&R<32*NM)b.state='commit';
    if(b.state==='commit'){b.psiC=Math.atan2(toMe.x,-toMe.z);b.altC=b.alt0;b.Vc=b.V0;b.gLim=4;}else if(b.state==='patrol'){b.gLim=2.5;}}
  // point-mass flight: turn rate limited by the g available, climb or dive towards the height wanted, speed towards the speed wanted
  const rl=9.81*Math.sqrt(max(b.gLim*b.gLim-1,0))/max(b.V,60),rr=clamp(wrapPI(b.psiC-b.psi)*1.5,-rl,rl);b.psi=wrapPI(b.psi+rr*dt);
  b.phi+=(Math.atan(b.V*rr/9.81)-b.phi)*min(1,dt*3);
  const gy=gnd(b.pos.x,b.pos.z);if(b.altC<gy+400)b.altC=gy+400;const gc=clamp((b.altC-b.pos.y)*0.003,-0.6,0.35);b.gam+=clamp(gc-b.gam,-0.5*dt,0.5*dt);
  b.V=max(120,b.V+(clamp((b.Vc-b.V)*0.25,-12,8)-4.9*sin(b.gam))*dt);banditVel(b);b.pos.addScaledVector(b.vel,dt);}
// ---------- radar ----------
function radarLook(b,B){B=B||bodyAxes(ac);const r=_cm[5].copy(b.pos).sub(ac.pos),R=r.length();const x=r.dot(B.rt),y=r.dot(B.u),z=r.dot(B.f);
  const az=Math.atan2(x,z),el=Math.atan2(y,Math.hypot(x,z));const inGim=z>0&&abs(az)<CMB.radar.gim&&abs(el)<CMB.radar.gim,inR=R<CMB.radar.range;
  r.divideScalar(max(R,1));const vr=b.vel.dot(r),notch=r.y<-0.03&&abs(vr)<45;
  return {R,az,el,inGim,inR,notch,ok:b.alive&&inGim&&inR&&!notch,closure:ac.va.dot(r)-vr,alt:b.pos.y};}
function breakLock(why){CMB.lock=null;CMB.lockInfo=null;CMB.dlz=null;CMB.notchT=0;if(why)cmbMsg(why,'warn');}
// Tab: lock the contact nearest the nose; with a lock, step to the next contact
function lockNext(){if(!CMB.bandits.length){cmbMsg('NO RADAR CONTACTS','');return;}const B=bodyAxes(ac);
  const c=CMB.bandits.filter(b=>b.alive).map(b=>({b,L:Object.assign({},radarLook(b,B))})).filter(x=>x.L.ok).sort((p,q)=>Math.hypot(p.L.az,p.L.el)-Math.hypot(q.L.az,q.L.el));
  if(!c.length){cmbMsg('NO CONTACT IN THE RADAR CONE','');return;}
  let i=0;if(CMB.lock){const k=c.findIndex(x=>x.b===CMB.lock);i=(k+1)%c.length;}
  CMB.lock=c[i].b;CMB.lockInfo=c[i].L;CMB.notchT=0;CMB.dlz=dlzCalc();audio.lock&&audio.lock();cmbMsg('LOCK '+CMB.lock.name+' · '+(c[i].L.R/NM).toFixed(1)+' NM','go');}
// ---------- launch zone: a quick straight-line fly-out of the missile against the target's present motion ----------
// Rmax: the farthest launch from which the missile still reaches the target, above about Mach 0.85, if the target holds its course;
// Rne (no-escape): the same if the target turns away at full speed the moment the missile leaves; Rmin: the arming distance
function dlzCalc(){const b=CMB.lock,L=CMB.lockInfo;if(!b||!L)return null;const los=_cm[6].copy(b.pos).sub(ac.pos).normalize();
  // the target's motion along the line of sight (positive: going away) and across it; a crossing target has to be led
  const v0=max(ac.V,ac.va.dot(los)),vt=b.vel.dot(los),vx2=max(0,b.vel.lengthSq()-vt*vt),hm=(ac.pos.y+b.pos.y)/2,h=hm+(2500+3000*clamp((6000-hm)/4500,0,1))*clamp(-vt/max(b.V,1),0,1),   /* long shots loft into thinner air, most usefully when low */atm=isa(min(h,20000));
  let s=0,v=v0,m=AMR.m0,t=0,rmax=0,rne=0,tof=null;const dt=0.2,vmin=AMR.vDead+20,vne=b.V;
  while(t<AMR.life){const burn=t<AMR.tb;if(burn)m-=AMR.mdot*dt;const D=0.5*atm.rho*v*v*AMR.A*amrCd(v/atm.a,burn);v+=((burn?AMR.T:0)-D)/m*dt;s+=v*dt;t+=dt;
    if(v<vmin&&!burn)break;const reach=-vt*t+Math.sqrt(max(0,s*s-vx2*t*t));rmax=max(rmax,reach);rne=max(rne,s-vne*t);if(tof==null&&reach>=L.R)tof=t;}
  // calibrated against full fly-outs (test/combat-test.js): the straight line is right head-on, long on a target crossing or running
  const fa=0.9-0.06*vt/max(b.V,1)-0.12*Math.sqrt(vx2)/max(b.V,1);
  return {rmax:rmax*fa,rne:rne*0.8,rmin:max(1100,v0*AMR.arm+300),tof};}
// ---------- missiles ----------
function fireMissile(){
  if(CMB.stores<=0){cmbMsg('NO MISSILES LEFT','');return null;}if(ac.onGround){cmbMsg('WEIGHT ON WHEELS · NO LAUNCH','');return null;}
  const k=[0,1,2,3].find(i=>CMB.st[i]);const B=bodyAxes(ac),o=CMB_STA[k];
  const pos=ac.pos.clone().addScaledVector(B.rt,o[0]).addScaledVector(B.u,o[1]).addScaledVector(B.f,-o[2]);
  const m={pos,vel:ac.va.clone().addScaledVector(B.f,6).addScaledVector(B.u,-3),mass:AMR.m0,t:0,alive:true,deadT:0,tgt:CMB.lock,est:null,estV:null,active:false,seek:null,
    loft:0,warn:null,res:'',st:k,id:CMB.fired+1,burn:true,minD:1e9,R:0};
  if(m.tgt){m.est=m.tgt.pos.clone();m.estV=m.tgt.vel.clone();m.loft=m.est.distanceTo(pos)>20000?1:0;m.warn=CMB.t+0.6+CMB.rnd()*1.4;}
  else{m.est=pos.clone().addScaledVector(B.f,40000);m.estV=new THREE.Vector3();}   // maddog: flies out along the nose and goes active on its own
  CMB.msls.push(m);CMB.stores--;CMB.st[k]=0;CMB.fired++;audio.msl&&audio.msl();cmbMsg(m.tgt?'FOX 3 · '+m.tgt.name:'FOX 3 · MADDOG','go');return m;}
function seekerAcquire(m,vh){let best=null,bd=1e12;for(const b of CMB.bandits){if(!b.alive)continue;const r=_cm[7].copy(b.pos).sub(m.pos),R=r.length();
    if(R>AMR.seekR||r.dot(vh)<R*Math.cos(AMR.seekFov))continue;const d=b.pos.distanceToSquared(m.est);if(d<bd){bd=d;best=b;}}return best;}
function mslStep(m,dt){
  m.t+=dt;const atm=isa(min(max(m.pos.y,0),20000)),V=m.vel.length(),vh=_cm[0].copy(m.vel).divideScalar(max(V,1));const burn=m.t<AMR.tb;m.burn=burn;if(burn)m.mass=max(AMR.mb,m.mass-AMR.mdot*dt);
  // what the missile knows of the target: its own seeker once active, the aircraft's radar over the data link while the lock holds,
  // otherwise the last data extrapolated
  let T,TV;
  if(m.active&&m.seek&&(m.seek.isDecoy||m.seek.alive)){T=m.seek.pos;TV=m.seek.vel;}
  else if(!m.active&&m.tgt&&CMB.lock===m.tgt&&m.tgt.alive){m.est.copy(m.tgt.pos);m.estV.copy(m.tgt.vel);T=m.est;TV=m.estV;}
  else{if(m.active&&m.seek&&!m.seek.isDecoy&&!m.seek.alive)m.seek=null;m.estV.y*=1-min(1,dt*0.5);m.est.addScaledVector(m.estV,dt);m.est.y=max(m.est.y,gnd(m.est.x,m.est.z)+300);T=m.est;TV=m.estV;}
  const r=_cm[1].copy(T).sub(m.pos),R=r.length();m.R=R;
  if(!m.active&&R<AMR.pit&&m.t>1){m.active=true;m.seek=seekerAcquire(m,vh);if(m.seek){m.warn=m.warn==null?CMB.t+0.3:min(m.warn,CMB.t+0.3);if(m.tgt===m.seek||!m.tgt)cmbMsg('PITBULL · '+m.seek.name,'');}}
  else if(m.active&&!m.seek&&((m.t*4)|0)!==(((m.t-dt)*4)|0)){m.seek=seekerAcquire(m,vh);}
  // active seeker: loses the target outside its ±45° gimbal, or (now and then) when the target is notched below it
  if(m.active&&m.seek&&!m.seek.isDecoy){const ang=r.dot(vh)/max(R,1);const lm=_cm[2].copy(r).divideScalar(max(R,1));
    if(ang<Math.cos(45*DEG))m.seek=null;else if(lm.y<-0.05&&abs(m.seek.vel.dot(lm))<45&&CMB.rnd()<0.2*dt){m.seek=null;m.est.copy(T);}}
  // chaff only holds the seeker until it sees the cloud slow down out of its Doppler window; then it looks for the target again
  if(m.seek&&m.seek.isDecoy&&(R<40||CMB.t-m.decT>1.5)){m.est.copy(T);m.estV.set(0,0,0);m.seek=seekerAcquire(m,vh);}
  // guidance: lofted pursuit of a point above the predicted intercept in the long midcourse, proportional navigation after that
  const ac_=_cm[3].set(0,0,0);
  if(!m.active&&m.loft&&R>14000){const vr=_cm[4].copy(TV).sub(m.vel),vc=max(250,-r.dot(vr)/max(R,1)),tgo=R/vc;const P=_cm[5].copy(T).addScaledVector(TV,tgo);
    P.y+=min(0.12*R,5000)*clamp((R-14000)/12000,0,1);const dir=P.sub(m.pos).normalize();ac_.copy(dir).sub(vh).multiplyScalar(V*3);}
  else{const vr=_cm[4].copy(TV).sub(m.vel),Om=_cm[5].crossVectors(r,vr).divideScalar(max(R*R,1)),Vc=-r.dot(vr)/max(R,1);
    ac_.crossVectors(Om,_cm[6].copy(r).divideScalar(max(R,1))).multiplyScalar(AMR.N*max(Vc,150));}
  ac_.y+=9.81;ac_.addScaledVector(vh,-ac_.dot(vh));
  const qb=0.5*atm.rho*V*V,amax=min(AMR.gMax*9.81,qb*AMR.Sl*2.5/m.mass),al=ac_.length();if(al>amax)ac_.multiplyScalar(amax/al);
  // forces: motor, body drag (by Mach), induced drag of the lift used to turn, gravity
  const Nf=m.mass*min(al,amax),Dp=qb*AMR.A*amrCd(V/atm.a,burn),Di=qb>1?Nf*Nf/(qb*AMR.Sl)*0.2:0;
  m.vel.addScaledVector(vh,((burn?AMR.T:0)-Dp-Di)/m.mass*dt).addScaledVector(ac_,dt);m.vel.y-=9.81*dt;
  // proximity fuze: closest approach to any target during this step
  const p0=_cm[7].copy(m.pos);m.pos.addScaledVector(m.vel,dt);
  if(m.t>AMR.arm)for(const b of CMB.bandits){if(!b.alive)continue;const d0=_cm[8].copy(p0).sub(b.pos),vrel=_cm[4].copy(m.vel).sub(b.vel),vv=vrel.lengthSq();
    const s0=-d0.dot(vrel)/max(vv,1),s=clamp(s0,0,dt),dmin=d0.addScaledVector(vrel,s).length();m.minD=min(m.minD,dmin);
    if(dmin<AMR.fuze&&(s0<=dt||dmin<3)){m.alive=false;const kill=dmin<AMR.kill||CMB.rnd()<0.6*(AMR.fuze-dmin)/(AMR.fuze-AMR.kill);cmbBoom(_cm[7].copy(p0).addScaledVector(m.vel,s),kill?1.6:1,false);
      if(kill){m.res='kill';b.alive=false;b.spin=(CMB.rnd()-0.5)*3;CMB.kills++;if(CMB.lock===b)breakLock('');cmbMsg('SPLASH '+b.name+' · good kill','go');}else{m.res='miss';cmbMsg('MISSILE '+m.id+' DETONATED · '+b.name+' STILL FLYING','warn');}
      return;}}
  if(m.pos.y<gnd(m.pos.x,m.pos.z)){m.alive=false;m.res='ground';cmbBoom(m.pos,0.8,true);return;}
  if(m.t>AMR.life||(!burn&&V<AMR.vDead&&m.t>12)){m.alive=false;m.res='trashed';if(m.tgt)cmbMsg('MISSILE '+m.id+' TRASHED · out of energy','warn');}}
function combatStep(dt){CMB.t+=dt;
  for(const b of CMB.bandits)banditStep(b,dt);
  for(const m of CMB.msls){if(m.alive)mslStep(m,dt);else m.deadT+=dt;}
  if(CMB.msls.length>8)CMB.msls=CMB.msls.filter(m=>m.alive||m.deadT<30);
  for(const d of CMB.decoys){d.pos.addScaledVector(d.vel,dt);d.vel.multiplyScalar(1-0.6*dt);d.vel.y-=1.5*dt;}if(CMB.decoys.length)CMB.decoys=CMB.decoys.filter(d=>CMB.t-d.t0<6);
  // the lock holds while the target stays in the cone and in range and does not sit in the notch for more than a moment
  if(CMB.lock){const L=radarLook(CMB.lock);CMB.lockInfo=Object.assign(CMB.lockInfo||{},L);
    if(!CMB.lock.alive)breakLock('');else if(!L.inGim)breakLock('LOCK LOST · gimbal limit');else if(L.R>CMB.radar.range*1.15)breakLock('LOCK LOST · out of range');
    else if(L.notch){CMB.notchT+=dt;if(CMB.notchT>1.2)breakLock('LOCK LOST · target in the notch');}else CMB.notchT=0;}
  CMB.scanT-=dt;if(CMB.scanT<=0){CMB.scanT=0.25;const B=bodyAxes(ac);CMB.contacts=CMB.bandits.filter(b=>b.alive&&radarLook(b,B).ok);if(CMB.lock)CMB.dlz=dlzCalc();}
  if(CMB.on&&!CMB.allDown&&CMB.bandits.length&&CMB.bandits.every(b=>!b.alive)){CMB.allDown=true;cmbMsg('ALL BANDITS DOWN · return to base and land on '+target.id,'go');}}
// </combat-sim>

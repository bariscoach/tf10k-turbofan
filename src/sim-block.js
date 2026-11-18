/* ================= Simulation ================= */
const sim={phase:'off',t:0,n1:0,n2:0,egt:ENG.ambient,ff:0,thrust:0,epr:1,opr:1,p3:14.7,t3:15,oilP:0,oilT:15,vib:0,
  starter:false,ignition:false,fuelOn:false,lit:false,throttle:0,litT:0,n2dot:0,fuelUsed:0,ab:0,abOn:false,abT:0,thrustAB:0};
const msgs=[];
function log(text,level){msgs.push({t:sim.t,text,level:level||''});if(msgs.length>60)msgs.shift();renderMsgs();}
function renderMsgs(){const ul=$('msgs');ul.innerHTML='';for(let i=msgs.length-1;i>=0&&i>=msgs.length-12;i--){const m=msgs[i];const li=document.createElement('li');li.className=m.level;const s=document.createElement('span');s.textContent=tcode(m.t);li.appendChild(s);li.appendChild(document.createTextNode(m.text));ul.appendChild(li);}}
function tcode(t){const mm=Math.floor(t/60),ss=Math.floor(t%60);return (mm<10?'0':'')+mm+':'+(ss<10?'0':'')+ss;}
const N1MAP=[[0,0],[20,3],[45,10],[60,22],[75,45],[85,65],[95,87],[100,100],[110,110]];
function n1ss(n2){for(let i=1;i<N1MAP.length;i++){if(n2<=N1MAP[i][0]){const a=N1MAP[i-1],c=N1MAP[i];return lerp(a[1],c[1],(n2-a[0])/(c[0]-a[0]));}}return 110;}

function startEngine(){
  if(sim.phase==='run'||sim.phase==='start')return;
  ensureAudio();
  sim.phase='start';sim.starter=true;sim.fuelOn=false;sim.lit=false;sim.ignition=false;sim.litT=0;sim.throttle=0;sim.fuelUsed=0;
  log('Start selected. Starter engaged, motoring N2.');audio.clunk(1);
  syncUI();
}
function shutdownEngine(){
  if(sim.phase==='off'||sim.phase==='shutdown')return;
  const was=sim.phase;
  sim.phase='shutdown';sim.starter=false;sim.fuelOn=false;sim.ignition=false;sim.lit=false;sim.throttle=0;
  log(was==='start'?'Start aborted. Fuel cut, starter disengaged.':'Fuel cutoff. Engine spooling down.','warn');audio.clunk(0.6);
  syncUI();
}
function step(dt){
  const s=sim;s.t+=dt;let n2dot=0;
  if(s.phase==='start'){
    if(s.starter&&!s.lit)n2dot=3.2*max(0.05,1-s.n2/27);
    if(!s.fuelOn&&s.n2>=20){s.fuelOn=true;s.ignition=true;s.litT=0;log('20 % N2. Igniters on, fuel valve open.');audio.clunk(0.4);}
    if(s.fuelOn&&!s.lit){s.litT+=dt;if(s.litT>1.6){s.lit=true;log('Light-off. EGT rising.','ok');audio.whoomp();}}
    if(s.lit)n2dot=(2.4+(s.n2-20)*0.12+(s.starter?1:0))*clamp((62-s.n2)/6,0.15,1);
    if(s.starter&&s.n2>=50){s.starter=false;log('Starter cutout at 50 % N2.');audio.clunk(0.7);}
    if(s.n2>=59.6){s.phase='run';s.ignition=false;log('Stabilized at ground idle. Thrust lever live.','ok');syncUI();}
  }else if(s.phase==='run'){
    // the first 90 % of the throttle travel is dry power (full military thrust at the detent); the last 10 % is afterburner
    const cmd=60+40*min(1,s.throttle/0.9),err=cmd-s.n2,x=clamp((s.n2-60)/40,0,1);
    n2dot=clamp(err*1.3,-(5+3*x),4+6*x);
  }else if(s.phase==='shutdown'){
    n2dot=-(0.6+0.07*s.n2);
    if(s.n2<0.3&&s.n1<0.3){s.n2=0;s.n1=0;s.phase='off';log('Rotors stopped.');syncUI();}
  }
  s.n2dot=n2dot;s.n2=max(0,s.n2+n2dot*dt);
  const tau1=(s.phase==='shutdown'||s.phase==='off')?7:1.6;s.n1+=(n1ss(s.n2)-s.n1)*(1-exp(-dt/tau1));
  let fft=0;
  if(s.fuelOn){
    if(s.phase==='start')fft=s.lit?300+220*clamp((s.n2-20)/40,0,1):300;
    else if(s.phase==='run'){const x=clamp((s.n2-60)/40,0,1);fft=520+3080*pow(x,1.6)+520*clamp(n2dot/8,0,1);}
  }
  // afterburner: past the detent, with the core at full speed, it lights after a short delay; thrust and fuel flow build over
  // about a second (min burner 15 % of the extra thrust, max 100 %) and it drops out at once when the throttle comes back
  {const abCmd=s.phase==='run'&&s.lit&&s.throttle>0.905&&s.n2>97?clamp((s.throttle-0.9)/0.1,0.15,1):0;
   if(abCmd>0){if(!s.abOn){s.abT+=dt;if(s.abT>0.4)s.abOn=true;}}else{s.abOn=false;s.abT=0;}
   s.ab+=((s.abOn?abCmd:0)-s.ab)*(1-exp(-dt/(s.abOn?0.7:0.25)));if(s.ab<1e-3&&!s.abOn)s.ab=0;
   s.thrustAB=(ENG.thrustAB-ENG.thrustMax)*s.ab;fft+=s.ab*ENG.ffAB;}
  s.ff+=(fft-s.ff)*(1-exp(-dt/0.35));s.fuelUsed+=s.ff/3600*dt;
  let egtT=ENG.ambient;
  if(s.lit)egtT=380+0.155*s.ff+(s.phase==='start'?190*clamp(1-(s.n2-20)/40,0,1):0);
  else if(s.n2>1)egtT=ENG.ambient+0.15*s.n2;
  const tauE=egtT>s.egt?1.4:(s.lit?4:8+(1-s.n2/100)*22);s.egt+=(egtT-s.egt)*(1-exp(-dt/tauE));
  const thT=s.lit?ENG.thrustMax*pow(s.n1/100,2.3):0;s.thrust+=(thT-s.thrust)*(1-exp(-dt/0.5));
  s.epr=1+0.65*s.thrust/ENG.thrustMax;s.opr=1+(ENG.opr-1)*pow(s.n2/100,2.5);s.p3=14.7*s.opr;s.t3=288*(1+(pow(s.opr,0.2857)-1)/0.85)-273;
  s.oilP=s.n2>3?6+0.57*s.n2:0;const oilTt=ENG.ambient+(s.lit?0.85:0.3)*s.n2;s.oilT+=(oilTt-s.oilT)*(1-exp(-dt/25));
  s.vib=s.n2>0.5?0.3+0.9*pow(s.n1/100,2)+(s.n2>38&&s.n2<52?1.6*sin(PI*(s.n2-38)/14):0)+0.12*(Math.random()-0.5):0;
}


/* ================= Audio ================= */
const audio={ctx:null,on:true,vol:0.7,igT:0,tickT:0,whoomp(){},clunk(){}};
function ensureAudio(){
  if(audio.ctx){if(audio.ctx.state==='suspended')audio.ctx.resume();return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ctx=new AC();audio.ctx=ctx;const sr=ctx.sampleRate;
  const g=(v)=>{const x=ctx.createGain();x.gain.value=v;return x;};
  const filt=(type,f,q)=>{const x=ctx.createBiquadFilter();x.type=type;x.frequency.value=f;if(q)x.Q.value=q;return x;};
  const osc=(type,f)=>{const o=ctx.createOscillator();if(type)o.type=type;o.frequency.value=f;o.start();return o;};
  // noise sources: white, brown (random walk) and pink (Paul Kellet filter)
  const N=sr*3;const white=ctx.createBuffer(1,N,sr),brown=ctx.createBuffer(1,N,sr),pink=ctx.createBuffer(1,N,sr);
  const w=white.getChannelData(0),b=brown.getChannelData(0),pk=pink.getChannelData(0);let acc=0,b0=0,b1=0,b2=0;
  for(let i=0;i<N;i++){const r=Math.random()*2-1;w[i]=r;acc=(acc+0.02*r)/1.02;b[i]=acc*3.5;b0=0.99765*b0+r*0.0990460;b1=0.96300*b1+r*0.2965164;b2=0.57000*b2+r*1.0526913;pk[i]=(b0+b1+b2+r*0.1848)*0.18;}
  const src=(buf,rate)=>{const x=ctx.createBufferSource();x.buffer=buf;x.loop=true;if(rate)x.playbackRate.value=rate;x.start();return x;};
  // bus -> dry + test-cell reverb -> compressor -> volume -> out
  const bus=g(1);audio.master=bus;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=5;comp.knee.value=14;comp.attack.value=0.01;comp.release.value=0.25;
  const vol=g(audio.on?audio.vol:0);audio.volNode=vol;
  // cabin filter between the engine voices and the output: wide open outside; in the cockpit the canopy and airframe cut the
  // whine and roar down to a low rumble (low-pass) that the body feels more than hears (low shelf)
  const cab=filt('lowpass',20000,0.5),cabSh=ctx.createBiquadFilter();cabSh.type='lowshelf';cabSh.frequency.value=140;cabSh.gain.value=0;
  bus.connect(cab).connect(cabSh).connect(comp);audio.cab=cab;audio.cabSh=cabSh;
  const ui=g(1);ui.connect(comp);audio.ui=ui;   // clicks and the cockpit's own sounds bypass the cabin filter
  {const len=Math.floor(sr*1.8);const ir=ctx.createBuffer(2,len,sr);
   for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++){const tt=i/sr;d[i]=(Math.random()*2-1)*Math.exp(-tt*3.2)*(i<sr*0.03?0.4:1);}}
   const conv=ctx.createConvolver();conv.buffer=ir;const wet=g(0.28);cabSh.connect(filt('lowpass',3500)).connect(conv).connect(wet).connect(comp);}
  comp.connect(vol).connect(ctx.destination);
  // jet mixing noise: low rumble (brown), mid roar (pink), hiss (white), with slow turbulence modulation
  audio.roarLP=filt('lowpass',200,0.6);audio.roarG=g(0);src(brown).connect(audio.roarLP).connect(audio.roarG).connect(bus);
  audio.midBP=filt('bandpass',500,0.6);audio.midG=g(0);src(pink).connect(audio.midBP).connect(audio.midG).connect(bus);
  audio.hissG=g(0);src(white).connect(filt('bandpass',2800,0.8)).connect(audio.hissG).connect(bus);
  {const turb=src(brown,0.004);const tg=g(0.35);turb.connect(filt('lowpass',3)).connect(tg);tg.connect(audio.roarG.gain);tg.connect(audio.midG.gain);}
  // combustion rumble with 7-8 Hz roughness
  audio.rumLP=filt('lowpass',70,0.9);audio.rumG=g(0);src(brown).connect(audio.rumLP).connect(audio.rumG).connect(bus);
  {const lfo=osc('sine',7.5),lg=g(0.14);lfo.connect(lg).connect(audio.rumG.gain);}
  // fan: shaft-order buzz-saw (40 harmonics), blade-pass tones, low hum
  // CFM-style buzz-saw: ~60 shaft-order harmonics with blade-to-blade irregularity (multiple pure tones), two detuned copies beating
  {const real=new Float32Array(61),imag=new Float32Array(61);for(let n=1;n<=60;n++){imag[n]=pow(n,-0.35)*(0.45+Math.random()*0.9)*(n<4?0.5:1);}audio.sawWave=ctx.createPeriodicWave(real,imag);}
  audio.buzzLP=filt('lowpass',3000,0.9);audio.buzzG=g(0);audio.buzzLP.connect(audio.buzzG).connect(bus);
  audio.buzz=osc(null,30);audio.buzz.setPeriodicWave(audio.sawWave);audio.buzz.connect(audio.buzzLP);
  audio.buzzB=osc(null,30);audio.buzzB.setPeriodicWave(audio.sawWave);const bbg=g(0.6);audio.buzzB.connect(bbg).connect(audio.buzzLP);
  audio.bpf=osc('sine',600);audio.bpfG=g(0);audio.bpf.connect(audio.bpfG).connect(bus);{const vb=osc('sine',5.3),vg=g(2.5);vb.connect(vg).connect(audio.bpf.frequency);}
  audio.bpf2=osc('sine',1200);audio.bpf2G=g(0);audio.bpf2.connect(audio.bpf2G).connect(bus);
  audio.fanLP=filt('lowpass',700,0.7);audio.fanG=g(0);audio.fan1=osc('sawtooth',40);audio.fan2=osc('sawtooth',41);audio.fan1.connect(audio.fanLP);audio.fan2.connect(audio.fanLP);audio.fanLP.connect(audio.fanG).connect(bus);
  // core: N2 shaft harmonics and HP compressor blade-pass whine with slight wander
  audio.core1=osc('sine',60);audio.core1G=g(0);audio.core1.connect(audio.core1G).connect(bus);
  audio.core2=osc('triangle',120);audio.core2G=g(0);audio.core2.connect(filt('lowpass',5000)).connect(audio.core2G).connect(bus);
  audio.hpc=osc('sine',3000);audio.hpcG=g(0);audio.hpc.connect(filt('lowpass',7500)).connect(audio.hpcG).connect(bus);
  {const vib=osc('sine',0.7),vg=g(6);vib.connect(vg).connect(audio.hpc.frequency);}
  // air-turbine starter: gear whine plus a sub harmonic
  audio.st=osc('sawtooth',100);audio.stG=g(0);audio.st.connect(filt('bandpass',2200,1.2)).connect(audio.stG).connect(bus);
  audio.st2=osc('sine',50);audio.st2G=g(0);audio.st2.connect(audio.st2G).connect(bus);
  audio.st3=osc('sine',200);audio.st3G=g(0);audio.st3.connect(audio.st3G).connect(bus);
  audio.svG=g(0);src(white).connect(filt('bandpass',1400,0.6)).connect(audio.svG).connect(bus);
  // one-shots
  const burst=(buf,f,type,amp,dur)=>{const t=ctx.currentTime;const x=ctx.createBufferSource();x.buffer=buf;const fl=filt(type,f);const e=g(0.0001);e.gain.setValueAtTime(amp,t);e.gain.exponentialRampToValueAtTime(0.0005,t+dur);x.connect(fl).connect(e).connect(ui);x.start(t);x.stop(t+dur+0.05);};
  const ping=(f0,f1,amp,dur)=>{const t=ctx.currentTime;const o=ctx.createOscillator();o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur*0.8);const e=g(0.0001);e.gain.setValueAtTime(amp,t);e.gain.exponentialRampToValueAtTime(0.0005,t+dur);o.connect(e).connect(ui);o.start(t);o.stop(t+dur+0.05);};
  audio.click=()=>{burst(white,3000,'highpass',0.55,0.03);ping(4200,0,0.12,0.05);};
  audio.whoomp=()=>{const t=ctx.currentTime;const x=ctx.createBufferSource();x.buffer=brown;const e=g(0.0001);e.gain.setValueAtTime(0.0001,t);e.gain.exponentialRampToValueAtTime(1.4,t+0.1);e.gain.exponentialRampToValueAtTime(0.0005,t+1.8);x.connect(filt('lowpass',140)).connect(e).connect(bus);x.start(t);x.stop(t+2);ping(70,35,0.5,1.5);};
  audio.clunk=(v)=>{v=v||1;burst(brown,400,'lowpass',0.8*v,0.18);ping(110,60,0.35*v,0.25);};
  audio.tick=()=>{ping(2500+Math.random()*3000,0,0.05+Math.random()*0.05,0.02);};
  audio.clack=()=>{burst(white,700+Math.random()*500,'bandpass',0.35+Math.random()*0.25,0.05);ping(520+Math.random()*260,0,0.08,0.06);};
}
function updateAudio(dt){
  const a=audio,s=sim;if(!a.ctx)return;const t=a.ctx.currentTime,k=0.08;
  const n1=s.n1/100,n2=s.n2/100,th=s.thrust/ENG.thrustMax;
  const F=a.dirF||1,R=a.dirR||1,D=a.dop||1,sh1=ENG.n1Max/60*n1*D,sh2=ENG.n2Max/60*n2*D;   // D: Doppler factor for the outside views
  const set=(p,v)=>p.setTargetAtTime(v,t,k);
  // fan
  set(a.fan1.frequency,max(20,sh1*4));set(a.fan2.frequency,max(20,sh1*4.02));set(a.fanG.gain,0.06*pow(n1,1.4)*F);
  const bz=clamp((n1-0.72)/0.28,0,1);set(a.buzz.frequency,max(20,sh1));set(a.buzzB.frequency,max(20,sh1*1.004));set(a.buzzG.gain,0.13*bz*bz*F);set(a.buzzLP.frequency,1200+3500*bz);
  const bpfF=sh1*ENG.fanBlades;set(a.bpf.frequency,max(40,bpfF));set(a.bpfG.gain,n1>0.05?(0.012+0.016*pow(n1,2))*F:0);
  set(a.bpf2.frequency,max(40,bpfF*2));set(a.bpf2G.gain,n1>0.05?(0.004+0.005*pow(n1,2))*F:0);
  // fan blades rocking in their dovetails at very low rpm (start and rundown)
  if(n1>0.002&&n1<0.06){a.clT=(a.clT||0)-dt;if(a.clT<=0){a.clack();a.clT=(0.08+Math.random()*0.5)/max(0.25,n1/0.03);}}
  // core
  set(a.core1.frequency,max(30,sh2*8));set(a.core1G.gain,0.045*pow(n2,2));
  set(a.core2.frequency,max(30,sh2*16));set(a.core2G.gain,0.01*pow(n2,2));
  set(a.hpc.frequency,max(100,min(9000,sh2*30)));set(a.hpcG.gain,n2>0.1?(0.003+0.004*pow(n2,3))*F:0);
  // jet
  const ab=s.ab||0;   // afterburner: a deeper, louder roar and more low rumble
  set(a.roarLP.frequency,(120+2200*pow(th,0.7)-400*ab)*D);set(a.roarG.gain,(s.lit?0.07+0.6*pow(th,0.8)+0.5*ab:0.03*n1)*R);
  set(a.midBP.frequency,(350+900*th)*D);set(a.midG.gain,(s.lit?0.05+0.45*pow(th,0.9):0.02*n1)*R);
  set(a.hissG.gain,(0.05*n1+0.3*pow(th,1.2))*R);
  set(a.rumLP.frequency,55+70*th);set(a.rumG.gain,s.lit?0.16+0.5*th+0.45*ab:0);
  // starter
  set(a.st.frequency,max(40,sh2*26));set(a.stG.gain,s.starter?0.05:0);set(a.st2.frequency,max(30,sh2*13));set(a.st2G.gain,s.starter?0.04:0);
  set(a.st3.frequency,max(60,sh2*52));set(a.st3G.gain,s.starter?0.02:0);set(a.svG.gain,s.starter?0.035:0);
  if(s.ignition){a.igT-=dt;if(a.igT<=0){a.click();a.igT=0.5+Math.random()*0.15;}}
  // cooling metal ticks after shutdown
  if(!s.lit&&s.egt>120&&s.n2<40){a.tickT-=dt;if(a.tickT<=0){a.tick();a.tickT=0.15+Math.random()*1.8*(1-clamp((s.egt-120)/600,0,1));}}
}
function applyVolume(){if(audio.volNode)audio.volNode.gain.setTargetAtTime(audio.on?audio.vol:0,audio.ctx.currentTime,0.05);}


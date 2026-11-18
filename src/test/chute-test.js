// Drag-chute checks, flown through the real physics: autoland at Istanbul 16R with and without the chute (streamed at
// touchdown), the chute inhibited in the air, shredded above its 185 kt limit, burned off by the afterburner, and a crosswind
// landing with the chute still ending on the runway. Usage: node test/chute-test.js  (after python3 test/mkharness.py)
const H=require('./harness.js');const DT=1/60,KT=0.5144;const a=H.ac,C=H.chute;
const rows=[];let fail=0;const check=(name,ok,val)=>{if(!ok)fail++;rows.push(`${ok?'ok  ':'FAIL'} ${name.padEnd(52)} ${val}`);};
const sub=(f)=>{H.step(DT);const n=Math.max(2,Math.ceil(DT/0.006));for(let i=0;i<n&&a.phase==='fly'&&!H.result();i++){H.flyStep(DT/n);f&&f();}};
function land(id,scen,useChute){const e=H.AIRPORTS.flatMap(x=>x.ends).find(x=>x.id===id);H.setScen(scen);H.setMission('approach');H.setTarget(e);H.resetFlight();
  a.gear=1;a.flaps=2;if(H.ap.on)H.apMode('AP');H.apMode('AP');H.apMode('APP');if(!H.ap.athr)H.apMode('ATHR');H.ap.sel.ias=Math.round(H.vref());
  let tdT=null,peak=0,airTry=false;
  for(let t=0;t<600&&!H.result();t+=DT)sub(()=>{if(useChute&&!airTry&&a.agl<40&&a.agl>10){airTry=true;H.chuteCmd();}
    if(useChute&&a.td&&C.st==='stowed'){tdT=a.t;H.chuteCmd();}if(C.st==='out')peak=Math.max(peak,C.F);});
  return {r:H.result(),stop:a.stopDist,peak,airTry};}
// 1. stopping distance with and without the chute (the autoland brakes on the runway either way)
const base=land('IST 16R',0,false),wc=land('IST 16R',0,true);
check('autoland without chute: stops on the runway',!!(base.r&&base.r.ok&&base.r.td.onRwy),Math.round(base.stop)+' m');
check('in the air at 10–40 m the chute stays stowed (inhibited)',wc.airTry&&C.kt>0&&C.kt<a.td.ias+2,'deployed at '+Math.round(C.kt)+' kt after touchdown');
check('with chute: stops on the runway',!!(wc.r&&wc.r.ok&&wc.r.td.onRwy),Math.round(wc.stop)+' m');
check('chute shortens the landing roll by 15–60 %',wc.stop<base.stop*0.85&&wc.stop>base.stop*0.4,Math.round((1-wc.stop/base.stop)*100)+' % shorter');
check('peak chute drag 15–40 kN (about 0.3–0.7 g)',wc.peak>15000&&wc.peak<40000,(wc.peak/1000).toFixed(1)+' kN = '+(wc.peak/(H.acMass()*9.81)).toFixed(2)+' g');
// 2. takeoff roll: deploy at a given speed (a rejected takeoff) with dry or afterburner power
function roll(thr,kt){const e=H.AIRPORTS.flatMap(x=>x.ends).find(x=>x.id==='IST 16R');H.setScen(0);H.setMission('takeoff');H.setTarget(e);H.resetFlight();a.brk=false;H.setThrottle(thr);
  let done=false;for(let t=0;t<120&&a.phase==='fly';t+=DT){sub();if(!done&&a.ias>=kt){done=true;H.chuteCmd();}if(done&&a.t>0)if(C.t>2||C.st!=='out')break;}
  for(let t=0;t<1;t+=DT)sub();return C.st+(C.why?'/'+C.why:'');}
let r=roll(88,150);check('rejected takeoff at 150 kt, dry power: chute holds',r==='out',r);
r=roll(88,200);check('streamed at 200 kt: chute shreds (limit 185 kt)',r==='failed/shred',r);
r=roll(100,110);check('afterburner lit with the chute out: it burns off',r==='failed/burn',r);
// 3. crosswind landing with the chute (it weathervanes; the autoland's steering holds the centreline)
const xw=land('IST 16R',1,true);check('12 kt crosswind with chute: stops on the runway',!!(xw.r&&xw.r.ok&&xw.r.td.onRwy),Math.round(xw.stop)+' m');
console.log(rows.join('\n'));console.log(`\n${fail?fail+' check(s) failed':'all checks passed'}`);process.exitCode=fail?1:0;

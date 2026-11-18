# Build test/harness.js: the game's engine simulation, flight physics, autopilot, airports and terrain code cut from the built
# page (out/hawk-landing.html), with small stand-ins for the browser (DOM, audio, result screen) and exports for the tests.
# The pieces are found by their first and last lines, so edits elsewhere in the page don't break it.
import os,sys
here=os.path.dirname(os.path.abspath(__file__))
page=open(os.path.join(here,'..','out','hawk-landing.html'),encoding='utf-8').read().split('\n')
def find(start,frm=0):
    for i in range(frm,len(page)):
        if page[i].startswith(start):return i
    sys.exit('marker not found: '+start)
a0=find('const {PI,sin,cos,tan,atan2,min,max,pow,exp,abs,sqrt}=Math;')
b0=find('function syncUI(){}',a0);bs=find('function step(',b0);b1=next(i for i in range(bs,len(page)) if page[i]=='}')   # engine simulation up to the end of step()
c0=find('/* ================= Aircraft ================= */',b1);c1=find('let onTouch=()=>{};',c0)
d0=find('function vsCalc(f)',c1);d1=find('function finish(){',d0)
three=os.environ.get('THREE_CJS','/Users/barishiz/Desktop/hair dresser/node_modules/three/build/three.cjs')
out=["const THREE=require('%s');"%three,
 "const document={getElementById:()=>({textContent:'',innerHTML:'',appendChild(){},value:'30',classList:{toggle(){},add(){},remove(){}},style:{}}),createElement:()=>({appendChild(){},className:'',classList:{toggle(){},add(){},remove(){}},style:{}})};",
 "const window={};const matchMedia=()=>({matches:false});const navigator={maxTouchPoints:0};const screen={width:1920,height:1080};"]
out+=page[a0:b1+1]
out+=["const audio={whoomp(){},clunk(){},thud(){},crashSound(){},chirp(){},click(){}};",
 "function ensureAudio(){}function ensureGameAudio(){}",
 "const thr={value:30};function updateThrOut(){}function syncSys(){}",
 "let RESULT=null;function showResult(ok,why){RESULT={ok,why,td:ac.td,stop:ac.stopDist,z:ac.pos.z};}",
 "function setThrottle(v){sim.throttle=Math.max(0,Math.min(100,v))/100;}",
 "const EVENTS=[];"]
out+=page[c0:c1+1]
out+=["let onEvent=(t)=>{EVENTS.push([ac.t.toFixed(1),t]);};let mission='approach';"]
out+=page[d0:d1+1]
out+=["module.exports={sync:()=>{ac.pOm=null;syncFromEuler(ac);},setMission:(m)=>{mission=m;},vrCalc,events:EVENTS,ac,inp,sim,AC,PM,ap,apMode,apSel,AIRPORTS,get target(){return target;},setTarget:(e)=>{target=e;},setAutoTrim:(v)=>{autoTrim=v;},setAutoRudder:(v)=>{autoRudder=v;},setPst:(v)=>{pst=v;},chute,chuteCmd,local,worldAt,resetFlight:()=>{RESULT=null;resetFlight();},flyStep,step,CL,setScen:(i)=>{scen=i;},vref:()=>vrefCalc(),isa,acMass,result:()=>RESULT,setThrottle:(v)=>{sim.throttle=Math.max(0,Math.min(100,v))/100;}};"]
open(os.path.join(here,'harness.js'),'w',encoding='utf-8').write('\n'.join(out)+'\n')
print('harness.js:',len(out),'lines')

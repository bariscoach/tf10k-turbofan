/* ================= Air combat: what you see and hear =================
   Missiles on four underwing rails, the bandits (a generic twin-tail fighter in two-tone aggressor grey), smoke trails, fireballs
   and falling wrecks drawn with one soft-particle system; the cockpit HUD's radar symbology (target box, launch zone, steering,
   SHOOT cue, missile timers), the same in the outside views, a radar page on the left display, and the sounds. */
const CV={init:false,rails:[],bandits:new Map(),msls:new Map(),ov:null,ovg:null,pfxT:0};
// ---------- soft particles: smoke (normal blending) and fire (additive, brighter than white in HDR) ----------
function mkPfx(N,add){const g=new THREE.BufferGeometry(),P=new Float32Array(N*3),A=new Float32Array(N*4),C=new Float32Array(N*4),V=new Float32Array(N*3);
  A.fill(-1e6);g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('aP',new THREE.BufferAttribute(A,4));g.setAttribute('aC',new THREE.BufferAttribute(C,4));g.setAttribute('aV',new THREE.BufferAttribute(V,3));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending,fog:false,uniforms:{uT:{value:0},uScale:GLU.uScale,uHdr:GLU.uHdr},
    vertexShader:`#include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uT,uScale;attribute vec4 aP;attribute vec4 aC;attribute vec3 aV;varying vec4 vC;varying float vK;
      void main(){float age=uT-aP.x,k=clamp(age/max(aP.y,0.01),0.0,1.0);vK=k;
        vec3 p=position+aV*age*(1.0-0.5*k)+vec3(0.0,${add?'0.0':'1.2'}*age,0.0);vec4 mv=viewMatrix*vec4(p,1.0);float d=max(-mv.z,1.0);
        gl_PointSize=(age<0.0||age>aP.y)?0.0:clamp(mix(aP.z,aP.w,sqrt(k))*uScale/d,1.5,400.0);vC=aC;gl_Position=projectionMatrix*mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`#include <logdepthbuf_pars_fragment>
      uniform float uHdr;varying vec4 vC;varying float vK;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 c=gl_PointCoord-0.5;float r=length(c)*2.0;if(r>1.0)discard;float a=vC.a*(1.0-vK)*smoothstep(1.0,0.25,r);if(a<0.003)discard;
        ${add?'gl_FragColor=vec4(vC.rgb*(1.0+uHdr*2.5*(1.0-vK)),a);':'gl_FragColor=vec4(vC.rgb*(0.75+0.25*(1.0-r)),a);'}
      }`});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;pts.renderOrder=add?6:4;return {pts,P,A,C,V,N,i:0,dirty:false,g};}
function pfxEmit(s,p,v,life,s0,s1,r,gg,b,a){const i=s.i;s.i=(i+1)%s.N;s.P[i*3]=p.x;s.P[i*3+1]=p.y;s.P[i*3+2]=p.z;s.V[i*3]=v?v.x:0;s.V[i*3+1]=v?v.y:0;s.V[i*3+2]=v?v.z:0;
  s.A[i*4]=CV.pfxT;s.A[i*4+1]=life;s.A[i*4+2]=s0;s.A[i*4+3]=s1;s.C[i*4]=r;s.C[i*4+1]=gg;s.C[i*4+2]=b;s.C[i*4+3]=a;s.dirty=true;}
function pfxFlush(s){if(!s.dirty)return;s.dirty=false;for(const k of['position','aP','aC','aV'])s.g.getAttribute(k).needsUpdate=true;}
const _cv1=new THREE.Vector3(),_cv2=new THREE.Vector3(),_cv3=new THREE.Vector3(),_q0=new THREE.Quaternion();
// ---------- models ----------
function mkMissileMesh(){const g=new THREE.Group(),mb=new THREE.MeshStandardMaterial({color:0xdfe3e6,roughness:0.45,metalness:0.2}),mk=new THREE.MeshStandardMaterial({color:0x2b2f33,roughness:0.6});
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.089,0.089,3.1,14).rotateX(PI/2),mb));
  const nose=new THREE.Mesh(new THREE.ConeGeometry(0.089,0.55,14).rotateX(-PI/2),new THREE.MeshStandardMaterial({color:0xcfd3c8,roughness:0.5}));nose.position.z=-1.82;g.add(nose);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.091,0.091,0.06,14).rotateX(PI/2),new THREE.MeshStandardMaterial({color:0xc9a227}));band.position.z=-0.9;g.add(band);
  const fin=(z,span,chord)=>{for(let k=0;k<4;k++){const f=new THREE.Mesh(new THREE.BoxGeometry(0.008,span,chord),mb);f.position.set(0,0,z);f.rotation.z=PI/4+k*PI/2;f.translateY(0.089+span/2);g.add(f);}};
  fin(-0.55,0.13,0.32);fin(1.38,0.16,0.3);
  const noz=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,0.08,12).rotateX(PI/2),mk);noz.position.z=1.58;g.add(noz);return g;}
function mkBanditMesh(){const g=new THREE.Group(),c1=new THREE.MeshStandardMaterial({color:0x7d8a96,roughness:0.55,metalness:0.15}),c2=new THREE.MeshStandardMaterial({color:0x56626e,roughness:0.6,metalness:0.15}),
    red=new THREE.MeshStandardMaterial({color:0xa4241c,roughness:0.6}),dk=new THREE.MeshStandardMaterial({color:0x202326,roughness:0.5,metalness:0.4}),
    gl=new THREE.MeshStandardMaterial({color:0x2a3a46,roughness:0.08,metalness:0.6,envMapIntensity:1.4});
  // fuselage: a lathe along the length (nose at -z), slightly flattened
  const prof=[[0.01,-9.4],[0.22,-8.6],[0.55,-7.2],[0.85,-5.4],[1.05,-3.4],[1.15,-1],[1.25,2.5],[1.2,5.5],[1.0,7.6],[0.9,8.8]].map(([r,z])=>new THREE.Vector2(r,z));
  const fus=new THREE.Mesh(new THREE.LatheGeometry(prof,18).rotateX(PI/2),c1);fus.scale.set(1.15,0.8,1);g.add(fus);
  const can=new THREE.Mesh(new THREE.SphereGeometry(0.62,16,10,0,2*PI,0,PI/2),gl);can.scale.set(0.8,0.85,2.4);can.position.set(0,0.62,-5.6);g.add(can);
  const plate=(pts,mat,y,th)=>{const sh=new THREE.Shape();sh.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(p=>sh.lineTo(p[0],p[1]));const geo=new THREE.ExtrudeGeometry(sh,{depth:th||0.12,bevelEnabled:false});geo.rotateX(PI/2);const m=new THREE.Mesh(geo,mat);m.position.y=y;g.add(m);return m;};
  for(const s of[-1,1]){plate([[1*s,-2.6],[7.2*s,2.8],[7.2*s,4.0],[1*s,4.6]],c2,0.05);   // wings: swept, clipped tips
    plate([[1*s,5.6],[3.9*s,7.6],[3.9*s,8.6],[1*s,8.8]],c2,0.0,0.08);                   // tailplanes
    const fin=new THREE.Shape();fin.moveTo(0,0);fin.lineTo(2.2,0);fin.lineTo(2.9,3.0);fin.lineTo(2.2,3.0);fin.closePath();
    const f=new THREE.Mesh(new THREE.ExtrudeGeometry(fin,{depth:0.08,bevelEnabled:false}),c1);f.rotation.order='ZYX';f.rotation.set(0,-PI/2,-0.22*s);f.position.set(1.0*s,0.55,5.6);g.add(f);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.35,1.1),red);stripe.position.set(1.0*s+0.55*s,2.7,7.9);stripe.rotation.z=-0.22*s;g.add(stripe);
    const n=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.45,1.2,14,1,true).rotateX(PI/2),dk);n.position.set(0.62*s,0,9.0);g.add(n);
    const glow=new THREE.Mesh(new THREE.CircleGeometry(0.42,14),new THREE.MeshBasicMaterial({color:0xff8a3a}));glow.position.set(0.62*s,0,9.45);g.add(glow);}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function initCombat3D(){if(CV.init||typeof drone==='undefined'||!drone)return;CV.init=true;
  CV.smoke=mkPfx(MOB?6000:20000,false);CV.fire=mkPfx(MOB?900:2500,true);scene.add(CV.smoke.pts);scene.add(CV.fire.pts);
  // rails and missiles on the aircraft (drone axes: x right, y up, nose at -z; station offsets are right, up, aft)
  const railM=new THREE.MeshStandardMaterial({color:0x6a7178,roughness:0.6,metalness:0.3});
  CMB_STA.forEach(o=>{const rail=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.12,2.6),railM);rail.position.set(o[0],o[1]+0.16,o[2]);rail.castShadow=true;drone.add(rail);
    const m=mkMissileMesh();m.position.set(o[0],o[1],o[2]);m.traverse(x=>{if(x.isMesh)x.castShadow=true;});drone.add(m);CV.rails.push(m);});
  // the outside-view overlay
  CV.ov=document.createElement('canvas');CV.ov.id='cmbOv';CV.ov.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';$('hud').appendChild(CV.ov);CV.ovg=CV.ov.getContext('2d');}
// explosion: a fireball, a smoke cloud, and on the ground a rising column; heard after the sound has travelled
cmbBoom=(p,size,ground)=>{if(!CV.init)return;const P=_cv3.copy(p);
  for(let i=0;i<26*size;i++){const v=_cv1.set(Math.random()-0.5,Math.random()-0.3,Math.random()-0.5).normalize().multiplyScalar(8+Math.random()*30*size);pfxEmit(CV.fire,P,v,0.5+Math.random()*0.9,4*size,(12+Math.random()*14)*size,1,0.55+Math.random()*0.25,0.2,0.9);}
  for(let i=0;i<14*size;i++){const v=_cv1.set(Math.random()-0.5,Math.random()*0.4,Math.random()-0.5).multiplyScalar(14*size);pfxEmit(CV.smoke,P,v,6+Math.random()*6,6*size,(28+Math.random()*20)*size,0.16,0.15,0.14,0.75);}
  if(ground)for(let i=0;i<10;i++)pfxEmit(CV.smoke,P,_cv1.set((Math.random()-0.5)*6,4+Math.random()*6,(Math.random()-0.5)*6),14,10,60,0.12,0.11,0.1,0.6);
  const d=camera.position.distanceTo(P);if(audio.ctx&&audio.boomFx&&d<40000){const k=clamp(2500/max(d,300),0.05,1)*size;setTimeout(()=>audio.boomFx(k),d/343*1000);}};
// ---------- per frame: bandits, missiles, trails, rails ----------
function updateCombat3D(dt){if(!CV.init){if(CMB.on||CMB.msls.length)initCombat3D();if(!CV.init)return;}
  CV.pfxT+=dt;CV.smoke.pts.material.uniforms.uT.value=CV.pfxT;CV.fire.pts.material.uniforms.uT.value=CV.pfxT;
  CV.rails.forEach((m,k)=>{m.visible=!!CMB.st[k];});
  const seen=new Set();for(const b of CMB.bandits){seen.add(b);let o=CV.bandits.get(b);if(!o){o=mkBanditMesh();scene.add(o);CV.bandits.set(b,o);}
    o.visible=!(b.ground&&b.deadT>3);o.position.copy(b.pos);o.rotation.order='YXZ';o.rotation.set(b.gam,-b.psi,-b.phi);
    if(!b.alive&&!b.ground&&Math.random()<dt*40){pfxEmit(CV.fire,b.pos,_cv1.copy(b.vel).multiplyScalar(-0.1),0.6,5,9,1,0.5,0.15,0.9);pfxEmit(CV.smoke,b.pos,null,12,5,22,0.1,0.1,0.1,0.8);}}
  for(const [b,o] of CV.bandits)if(!seen.has(b)){scene.remove(o);CV.bandits.delete(b);}
  // missiles: body along the velocity, motor flame and a white smoke trail while the motor burns
  const live=new Set();for(const m of CMB.msls){let o=CV.msls.get(m);if(!o){o=mkMissileMesh();scene.add(o);CV.msls.set(m,o);o.userData.last=m.pos.clone();}live.add(m);
    o.visible=m.alive;if(!m.alive)continue;o.position.copy(m.pos);_cv1.copy(m.pos).sub(m.vel);o.lookAt(_cv1);
    if(m.burn){const tail=_cv2.copy(m.vel).normalize().multiplyScalar(-1.8).add(m.pos),last=o.userData.last;
      const n=min(48,max(1,Math.ceil(last.distanceTo(tail)/1.6)));   // a puff every metre and a half, whatever the frame rate
      for(let i=0;i<n;i++){_cv1.copy(last).lerp(tail,(i+1)/n);pfxEmit(CV.smoke,_cv1,null,9+Math.random()*4,1.8,7,0.93,0.94,0.95,0.5);}
      pfxEmit(CV.fire,tail,_cv1.copy(m.vel).multiplyScalar(0.9),0.06,1.6,0.8,1,0.75,0.4,1);last.copy(tail);}
    else o.userData.last.copy(m.pos);}
  for(const [m,o] of CV.msls)if(!live.has(m)){scene.remove(o);CV.msls.delete(m);}
  pfxFlush(CV.smoke);pfxFlush(CV.fire);}
// ---------- symbology shared by the cockpit HUD and the outside views ----------
function cmbLead(){const b=CMB.lock,d=CMB.dlz;const t=d&&d.tof?d.tof:CMB.lockInfo.R/700;return _cv1.copy(b.pos).addScaledVector(b.vel,min(t,60));}
function cmbAng(p,B){const r=_cv2.copy(p).sub(ac.pos);const x=r.dot(B.rt),y=r.dot(B.u),z=r.dot(B.f);return {az:Math.atan2(x,z)/DEG,el:Math.atan2(y,Math.hypot(x,z))/DEG,front:z>0};}
// SHOOT: in range and the steering dot inside the circle; 2 inside the no-escape range (the cue flashes)
function cmbShoot(){const L=CMB.lockInfo,d=CMB.dlz;if(!CMB.lock||!L||!d||!CMB.stores)return 0;if(L.R>d.rmax||L.R<d.rmin)return 0;
  const a=cmbAng(cmbLead(),bodyAxes(ac));if(Math.hypot(a.az,a.el)>(L.R<d.rne?20:12))return 0;return L.R<d.rne?2:1;}
// the newest guided missile: time to its own radar going active ("A"), then time to impact ("T")
function cmbMslTimer(){let m=null;for(const x of CMB.msls)if(x.alive&&x.tgt&&(!m||x.id>m.id))m=x;if(!m)return '';const v=max(400,m.vel.length()+(m.tgt.alive?-m.tgt.vel.dot(_cv1.copy(m.vel).normalize()):0));
  return m.active?'T '+String(Math.round(m.R/v)).padStart(2,'0'):'A '+String(Math.round(max(0,m.R-AMR.pit)/v)).padStart(2,'0');}
// cockpit HUD (drawn to scale: 25 px per degree from the boresight at the canvas centre)
function drawCombatHUD(g,a,ppd,c){if(!CMB.on&&CMB.stores===4&&!CMB.msls.length)return;const B=bodyAxes(a);g.save();g.textAlign='left';g.textBaseline='middle';
  g.font=hf(600,18,'IBM Plex Mono, monospace');g.fillText('AIM-120 '+CMB.stores,40,400);const tm=cmbMslTimer();if(tm)g.fillText(tm,40,424);
  g.fillText(CMB.lock?'STT '+CMB.lock.name:'RWS',40,448);
  if(CMB.lock&&CMB.lockInfo){const L=CMB.lockInfo,d=CMB.dlz,an=cmbAng(CMB.lock.pos,B),x=c+an.az*ppd,y=c-an.el*ppd;
    if(an.front&&x>52&&x<460&&y>52&&y<460){g.lineWidth=3*HUDK.l;g.strokeRect(x-15,y-15,30,30);g.font=hf(600,16,'IBM Plex Mono, monospace');g.textAlign='left';
      g.fillText((L.R/NM).toFixed(1),x+20,y+24);g.textAlign='right';g.fillText(String(Math.round(L.alt/FT/1000)),x-20,y-24);g.textAlign='left';}
    else{const ang=Math.atan2(-an.el,an.az),off=Math.acos(clamp(cos(an.az*DEG)*cos(an.el*DEG),-1,1))/DEG;g.lineWidth=3*HUDK.l;g.beginPath();g.moveTo(c+cos(ang)*22,c+sin(ang)*22);g.lineTo(c+cos(ang)*105,c+sin(ang)*105);g.stroke();
      g.font=hf(600,16,'IBM Plex Mono, monospace');g.textAlign='center';g.fillText(Math.round(off)+'°',c+cos(ang)*128,c+sin(ang)*128);}
    // steering: the allowable-steering-error circle and the dot to put inside it (the lead to the intercept point)
    if(d){const R=L.R<d.rne?20:12,rr=min(R*ppd,150);g.lineWidth=2*HUDK.l;g.beginPath();g.arc(c,c,rr,0,2*PI);g.stroke();const lp=cmbAng(cmbLead(),B);
      const dx=clamp(lp.az*ppd,-rr-30,rr+30),dy=clamp(-lp.el*ppd,-rr-30,rr+30);g.beginPath();g.arc(c+dx,c+dy,7,0,2*PI);g.fill();
      // launch-zone scale: Rmax tick, the no-escape bar from Rmin to Rne, the target's range caret with the closure speed
      const top=1.25*max(L.R,d.rmax)/NM,sc=[10,20,40,80].find(v=>v>=top)||80,X=444,Y0=330,Y1=130,yy=r=>Y0-(Y0-Y1)*min(r/NM,sc)/sc;
      g.lineWidth=2*HUDK.l;g.beginPath();g.moveTo(X,Y1);g.lineTo(X,Y0);g.stroke();g.font=hf(600,14,'IBM Plex Mono, monospace');g.textAlign='center';g.fillText(String(sc),X,Y1-14);
      g.lineWidth=5*HUDK.l;g.beginPath();g.moveTo(X+8,yy(d.rmin));g.lineTo(X+8,yy(d.rne));g.stroke();g.lineWidth=2*HUDK.l;
      g.beginPath();g.moveTo(X,yy(d.rmax));g.lineTo(X+18,yy(d.rmax));g.stroke();g.beginPath();g.moveTo(X,yy(d.rmin));g.lineTo(X+12,yy(d.rmin));g.stroke();
      const ty=yy(L.R);g.beginPath();g.moveTo(X-4,ty);g.lineTo(X-16,ty-7);g.lineTo(X-16,ty+7);g.closePath();g.fill();g.textAlign='right';g.fillText(String(Math.round(L.closure/KT)),X-20,ty);
      const sh=cmbShoot();if(sh&&(sh===1||((CV.pfxT*4)|0)%2)){g.font=hf(700,30,'Rajdhani, sans-serif');g.textAlign='center';g.fillText('SHOOT',c,150);}}}
  g.restore();}
// outside views: boxes over the contacts, the lock and the missiles, and a compact weapons block
function drawCombatOverlay(){if(!CV.init)return;const cv=CV.ov,g=CV.ovg,[w,h]=sizeOf(view),dpr=min(window.devicePixelRatio||1,2);
  const show=(CMB.on||CMB.msls.length>0||CMB.stores<4)&&camMode!=='cockpit'&&!view.classList.contains('clean')&&$('title').hidden;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);if(!show)return;g.setTransform(dpr,0,0,dpr,0,0);
  const C='#7df5a0';g.strokeStyle=C;g.fillStyle=C;g.lineWidth=1.6;g.font='600 12px IBM Plex Mono, monospace';g.textBaseline='middle';g.shadowColor='rgba(0,0,0,.8)';g.shadowBlur=3;
  const proj=p=>{const v=_cv1.copy(p).project(camera);return {x:(v.x+1)/2*w,y:(1-v.y)/2*h,ok:v.z<1&&v.z>-1};};
  for(const b of CMB.bandits){if(!b.alive)continue;const lk=b===CMB.lock,see=CMB.contacts.includes(b);if(!lk&&!see)continue;const P=proj(b.pos),R=b.pos.distanceTo(ac.pos)/NM;
    if(P.ok&&P.x>0&&P.x<w&&P.y>0&&P.y<h){if(lk)g.strokeRect(P.x-11,P.y-11,22,22);else{g.beginPath();g.moveTo(P.x,P.y-8);g.lineTo(P.x+8,P.y);g.lineTo(P.x,P.y+8);g.lineTo(P.x-8,P.y);g.closePath();g.stroke();}
      g.textAlign='left';g.fillText(b.name+' '+R.toFixed(1),P.x+14,P.y-10);}
    else if(lk){const v=_cv2.copy(b.pos).sub(camera.position).applyQuaternion(_q0.copy(camera.quaternion).invert());const an=Math.atan2(-v.y,v.x),cx=w/2,cy=h/2,rr=min(w,h)*0.42;
      const x=cx+cos(an)*rr,y=cy+sin(an)*rr;g.beginPath();g.moveTo(x+cos(an)*12,y+sin(an)*12);g.lineTo(x+cos(an+2.5)*10,y+sin(an+2.5)*10);g.lineTo(x+cos(an-2.5)*10,y+sin(an-2.5)*10);g.closePath();g.fill();
      g.textAlign='center';g.fillText(b.name,x-cos(an)*18,y-sin(an)*18);}}
  g.strokeStyle='#ffb432';g.fillStyle='#ffb432';for(const m of CMB.msls){if(!m.alive)continue;const P=proj(m.pos);if(!P.ok)continue;g.beginPath();g.arc(P.x,P.y,5,0,2*PI);g.stroke();g.textAlign='left';g.fillText('M'+m.id,P.x+8,P.y);}
  // weapons block, lower left
  g.fillStyle=C;g.strokeStyle=C;g.textAlign='left';g.font='600 13px IBM Plex Mono, monospace';const x0=max(14,w*0.03),L=CMB.lockInfo,d=CMB.dlz;let y=h-150;
  const line=t=>{g.fillText(t,x0,y);y+=18;};
  line('AIM-120 ×'+CMB.stores+'   '+cmbMslTimer());
  if(CMB.lock&&L){line('STT '+CMB.lock.name+' · '+(L.R/NM).toFixed(1)+' NM · VC '+Math.round(L.closure/KT)+' · '+Math.round(L.alt/FT/1000)+'K');
    if(d){line('Rmax '+(d.rmax/NM).toFixed(0)+'  Rne '+(d.rne/NM).toFixed(0)+'  Rmin '+(d.rmin/NM).toFixed(1));
      const bw=180,sc=[10,20,40,80].find(v=>v>=1.25*max(L.R,d.rmax)/NM)||80,X=r=>x0+bw*min(r/NM,sc)/sc;g.strokeRect(x0,y-6,bw,8);g.fillRect(X(d.rmin),y-6,X(d.rne)-X(d.rmin),8);
      g.beginPath();g.moveTo(X(d.rmax),y-10);g.lineTo(X(d.rmax),y+6);g.stroke();g.beginPath();g.moveTo(X(L.R),y+4);g.lineTo(X(L.R)-6,y+13);g.lineTo(X(L.R)+6,y+13);g.closePath();g.fill();y+=24;
      const sh=cmbShoot();if(sh&&(sh===1||((CV.pfxT*4)|0)%2)){g.font='700 24px Rajdhani, sans-serif';g.fillText('SHOOT',x0,y+4);}}}
  else line(CMB.contacts.length?'RWS · '+CMB.contacts.length+' contact'+(CMB.contacts.length>1?'s':'')+' · Tab to lock':CMB.on?'RWS · no contacts':'RWS');}
// radar page on the left display: a B-scope, azimuth across (±60°), range up
function drawRadarMFD(d){const g=ckBg(d,'#03080a');const R=CMB.lock&&CMB.lockInfo?[10,20,40,80].find(v=>v>=1.2*CMB.lockInfo.R/NM)||80:40,X=az=>256+az/60*220,Y=r=>470-min(r/NM,R)/R*420;
  g.strokeStyle='rgba(125,245,160,.35)';g.lineWidth=1.5;g.strokeRect(36,50,440,420);g.beginPath();for(const a of[-30,0,30]){g.moveTo(X(a),50);g.lineTo(X(a),470);}for(let k=1;k<4;k++){g.moveTo(36,470-k*105);g.lineTo(476,470-k*105);}g.stroke();
  g.fillStyle='#bfffd0';g.font='700 16px Rajdhani, sans-serif';g.textBaseline='middle';g.textAlign='left';g.fillText(CMB.lock?'STT '+CMB.lock.name:'RWS',12,26);g.textAlign='right';g.fillText(R+' NM',500,26);
  g.textAlign='center';g.fillText('AIM-120 ×'+CMB.stores,256,26);g.font='600 13px IBM Plex Mono, monospace';g.textAlign='left';for(let k=1;k<=4;k++)g.fillText(String(R*k/4),40,470-k*105+10);
  const B=bodyAxes(ac);
  for(const b of CMB.bandits){if(!b.alive)continue;const lk=b===CMB.lock;if(!(lk||CMB.contacts.includes(b)))continue;const L=radarLook(b,B),x=X(L.az/DEG),y=Y(L.R);
    g.fillStyle=lk?'#ffe27a':'#bfffd0';g.strokeStyle=g.fillStyle;if(lk){g.lineWidth=2;g.strokeRect(x-9,y-9,18,18);const hd=Math.atan2(b.vel.dot(B.rt),b.vel.dot(B.f));g.beginPath();g.moveTo(x,y);g.lineTo(x+sin(hd)*26,y-cos(hd)*26);g.stroke();}
    else g.fillRect(x-6,y-6,12,12);g.font='600 13px IBM Plex Mono, monospace';g.textAlign='left';g.fillText(b.name+' '+Math.round(b.pos.y/FT/1000),x+12,y+12);}
  g.fillStyle='#ffb432';for(const m of CMB.msls){if(!m.alive)continue;const L=radarLook({pos:m.pos,vel:m.vel,alive:true},B);if(!L.inGim)continue;g.beginPath();g.arc(X(L.az/DEG),Y(L.R),4,0,2*PI);g.fill();}
  if(CMB.lock&&CMB.dlz){const dz=CMB.dlz;g.strokeStyle='#bfffd0';g.lineWidth=2;g.beginPath();g.moveTo(486,Y(dz.rmax));g.lineTo(500,Y(dz.rmax));g.stroke();g.lineWidth=5;g.beginPath();g.moveTo(494,Y(dz.rmin));g.lineTo(494,Y(dz.rne));g.stroke();}
  g.fillStyle='#bfffd0';g.font='600 14px IBM Plex Mono, monospace';g.textAlign='center';g.fillText(CMB.on?(CMB.bandits.filter(b=>b.alive).length+' bandits · Tab lock · Enter fire'):'no bandits in this mission',256,492);d.t.needsUpdate=true;}
// ---------- sounds ----------
function cmbAudio(){if(!audio.ctx||cmbAudio.ok)return;cmbAudio.ok=true;const c=audio.ctx;
  audio.lock=()=>{const t=c.currentTime;for(const k of[0,0.12]){const o=c.createOscillator(),g=c.createGain();o.frequency.value=1250;g.gain.setValueAtTime(0.0001,t+k);g.gain.exponentialRampToValueAtTime(0.06,t+k+0.01);g.gain.exponentialRampToValueAtTime(0.0005,t+k+0.08);o.connect(g).connect(audio.master);o.start(t+k);o.stop(t+k+0.1);}};
  audio.msl=()=>{const buf=audio.white||audio.brown;if(!buf)return;const t=c.currentTime,s=c.createBufferSource();s.buffer=buf;s.loop=true;const f=c.createBiquadFilter();f.type='bandpass';f.Q.value=0.8;f.frequency.setValueAtTime(900,t);f.frequency.exponentialRampToValueAtTime(220,t+2.2);
    const g=c.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.9,t+0.05);g.gain.exponentialRampToValueAtTime(0.0005,t+2.6);s.connect(f).connect(g).connect(audio.master);s.start(t);s.stop(t+2.7);};
  audio.boomFx=k=>{if(!audio.brown)return;const t=c.currentTime,s=c.createBufferSource();s.buffer=audio.brown;s.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=380;
    const g=c.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(max(0.001,1.6*k),t+0.03);g.gain.exponentialRampToValueAtTime(0.0005,t+2.2);s.connect(f).connect(g).connect(audio.master);s.start(t);s.stop(t+2.3);};}
// ---------- controls ----------
function cmbLock(){cmbAudio();lockNext();syncWpn();}
function cmbUnlock(){if(CMB.lock){breakLock('');cmbMsg('LOCK BROKEN · radar back to search','');}syncWpn();}
function cmbFire(){cmbAudio();initCombat3D();fireMissile();syncWpn();}
function syncWpn(){const s=$('wpnStat');if(s)s.textContent='AIM-120 ×'+CMB.stores+(CMB.lock?' · lock '+CMB.lock.name:CMB.on?' · no lock':'');}

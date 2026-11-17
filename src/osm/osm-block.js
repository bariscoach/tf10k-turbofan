 // ---------- real buildings from OpenStreetMap (desktop): about 718,000 footprints in 2 km cells, packed by osm/pack.py into
 // gzip'd blocks ob_{bx}_{bz}.dat. Cells within 3.5 km get every building and the park trees; out to 22 km only the large and
 // tall ones. Geometry is built a few milliseconds per frame so streaming never stalls input. Once the first block arrives the
 // random city blocks above are removed; if the files can't be read (or on phones) the random city stays.
 // block layout: u32 magic, u16 nCells, nCells x {u16 i,u16 j,u32 nFar,u32 nAll,u32 nTrees,u32 offset}, then per cell nAll records
 // {u8 type,u8 0,u16 height dm,u8 wall colour,u8 roof colour,u16 n,n x (i16 x,i16 z dm from the cell centre)} (far ones first) and
 // nTrees x {i16 x,i16 z,u8 seed}. Types: 0 building, 2 mosque, 3 industrial, 4 stadium, 5 city wall, 6 aqueduct.
 const OSMB={on:!MOB&&typeof DecompressionStream!=='undefined',X0:-46158.7,Z0:-25603.6,CELL:2000,BLK:8,NB:[6,4],NEAR:3500,FAR:22000,
   blocks:new Map(),cells:[],queue:[],job:null,ok:false,t:0,loading:0,tris:0};
 {const lin=c=>c.map(v=>Math.round(255*Math.pow(v/255,2.2)));
  OSMB.WALL=[[233,225,207],[238,238,234],[212,212,208],[217,199,168],[232,217,160],[217,166,140],[185,198,207],[207,168,110],[181,170,154],[227,195,189],[201,210,176],[224,214,196]].map(lin);
  OSMB.ROOF=[[180,97,63],[143,74,51],[142,143,140],[169,169,163],[109,111,112],[123,133,140],[156,143,128],[196,190,178]].map(lin);
  const oT=wt.clone(),oE=wtE.clone();[oT,oE].forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1/34,1/310);t.needsUpdate=true;});
  // u runs along the walls in half metres, v up them in decimetres: one texture tile is five 3.4 m window bays by ten 3.1 m floors
  OSMB.mat=S({map:oT,emissiveMap:oE,emissive:0xffffff,emissiveIntensity:0,vertexColors:true,roughness:0.88,flatShading:true});CITYM2=OSMB.mat;
  OSMB.treeGeo=new THREE.IcosahedronGeometry(1,0);OSMB.treeGeo.scale(3.2,3.8,3.2);OSMB.treeGeo.translate(0,4.6,0);
  OSMB.treeMat=S({color:0xffffff,roughness:0.95,flatShading:true});
  // tiny hidden stand-ins so the warm-up compiles both materials before the first cell is built
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Int16BufferAttribute([0,0,0,1,0,0,0,0,1],3));g.setAttribute('uv',new THREE.Int16BufferAttribute([0,0,0,0,0,0],2));g.setAttribute('color',new THREE.Uint8BufferAttribute([255,255,255,255,255,255,255,255,255],3,true));
  const w1=new THREE.Mesh(g,OSMB.mat);w1.visible=false;w1.frustumCulled=false;scene.add(w1);const w2=new THREE.InstancedMesh(OSMB.treeGeo,OSMB.treeMat,1);w2.setColorAt(0,new THREE.Color(0x335522));w2.visible=false;scene.add(w2);}
 const KEEPO=KEEP.map(k=>[k[0],k[1],k[2]*0.55]);
 const skipAt=(x,z)=>nearAirport(x,z,120)||BRIDGES.some(b=>Math.hypot(x-b.cx,z-b.cz)<b.len/2+BRIDGE_RAMP)||KEEPO.some(k=>abs(x-k[0])<k[2]&&abs(z-k[1])<k[2]);
 function loadBlock(bx,bz){const key=bx+'_'+bz;if(OSMB.blocks.has(key))return;OSMB.blocks.set(key,1);OSMB.loading++;
   fetch(ASSET+'ob_'+key+'.dat').then(r=>{if(!r.ok)throw 0;return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}).then(buf=>{
     const dv=new DataView(buf),n=dv.getUint16(4,true);
     for(let k=0;k<n;k++){const o=6+20*k,i=dv.getUint16(o,true),j=dv.getUint16(o+2,true);
       OSMB.cells.push({i,j,dv,nFar:dv.getUint32(o+4,true),nAll:dv.getUint32(o+8,true),nTrees:dv.getUint32(o+12,true),off:6+20*n+dv.getUint32(o+16,true),
         cx:OSMB.X0+(i+0.5)*OSMB.CELL,cz:OSMB.Z0+(j+0.5)*OSMB.CELL,have:0,mesh:null,trees:null,farIdx:0,q:0});}
     OSMB.blocks.set(key,2);OSMB.loading--;
     if(!OSMB.ok){OSMB.ok=true;cityChunks.forEach(c=>{scene.remove(c.m);c.m.dispose();});cityChunks.length=0;PHOTO.city=0;}
   }).catch(()=>{OSMB.blocks.set(key,3);OSMB.loading--;});}
 function dropCell(c){if(c.mesh){scene.remove(c.mesh);c.mesh.geometry.dispose();c.mesh=null;}if(c.trees){scene.remove(c.trees);c.trees.dispose();c.trees=null;}c.have=0;c.q=0;}
 function watch(){const p=camera.position,C=OSMB.CELL,BS=C*OSMB.BLK;
   if(!OSMB.loading)for(let bx=0;bx<OSMB.NB[0];bx++)for(let bz=0;bz<OSMB.NB[1];bz++){const x0=OSMB.X0+bx*BS,z0=OSMB.Z0+bz*BS;
     const d=Math.hypot(max(0,x0-p.x,p.x-x0-BS),max(0,z0-p.z,p.z-z0-BS));if(d<OSMB.FAR+1000&&!OSMB.blocks.has(bx+'_'+bz)){loadBlock(bx,bz);break;}}
   for(const c of OSMB.cells){const d=Math.hypot(max(0,abs(p.x-c.cx)-C/2),max(0,abs(p.z-c.cz)-C/2));
     let want=d<OSMB.NEAR?2:d<OSMB.FAR?1:0;if(c.have===2&&d<OSMB.NEAR+1200)want=2;else if(c.have>=1&&want===0&&d<OSMB.FAR+2500)want=1;
     if(want===0){if(c.have)dropCell(c);continue;}
     if(c.mesh&&c.mesh.userData.full){ // a fully built cell switches between near and far by draw range alone
       c.mesh.geometry.setDrawRange(0,want===2?Infinity:c.farIdx);if(c.trees)c.trees.visible=want===2;c.have=want;continue;}
     if(want>c.have&&!c.q){c.q=want;c.d=d;OSMB.queue.push(c);}}
   OSMB.queue.forEach(c=>{c.d=Math.hypot(p.x-c.cx,p.z-c.cz);});OSMB.queue.sort((a,b)=>a.d-b.d);}
 // geometry writer: positions in decimetres from the cell centre (Int16), wall uv, linear vertex colour
 function startJob(c,lod){return{c,lod,k:0,off:c.off,n:lod===2?c.nAll:c.nFar,P:[],U:[],C:[],I:[],farIdx:null};}
 function emit(J,x,y,z,u,v,col){J.P.push(Math.round(x*10),Math.round(y*10),Math.round(z*10));J.U.push(u,v);J.C.push(col[0],col[1],col[2]);return J.P.length/3-1;}
 // triangle with a wanted outward direction (hx,hy,hz): flips the winding when needed
 function triO(J,a,b,c2,hx,hy,hz){const P=J.P,ax=P[a*3],ay=P[a*3+1],az=P[a*3+2],ux=P[b*3]-ax,uy=P[b*3+1]-ay,uz=P[b*3+2]-az,vx=P[c2*3]-ax,vy=P[c2*3+1]-ay,vz=P[c2*3+2]-az;
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(nx*hx+ny*hy+nz*hz<0)J.I.push(a,c2,b);else J.I.push(a,b,c2);}
 const _ring=[],_v2=[];
 function prism(J,R,base,top,col,uvOn){ // walls of a closed ring (any winding) from base to top
   const n=R.length;let A=0;for(let i=0;i<n;i++){const a=R[i],b=R[(i+1)%n];A+=a[0]*b[1]-b[0]*a[1];}
   let s=0;const i0=J.P.length/3;
   for(let i=0;i<=n;i++){const q=R[A>0?(n-i)%n:i%n];if(i>0){const pq=R[A>0?(n-i+1)%n:(i-1)%n];s+=Math.hypot(q[0]-pq[0],q[1]-pq[1]);}
     const u=uvOn?Math.min(32000,Math.round(s*2)):0;emit(J,q[0],base,q[1],u,0,col);emit(J,q[0],top,q[1],u,uvOn?Math.min(32000,Math.round((top-base)*10)):0,col);}
   for(let i=0;i<n;i++){const b0=i0+i*2,t0=b0+1,b1=b0+2,t1=b0+3;J.I.push(b0,b1,t1,b0,t1,t0);}}
 function roof(J,R,y,col){const n=R.length,i0=J.P.length/3;for(const q of R)emit(J,q[0],y,q[1],0,0,col);
   if(n===3){triO(J,i0,i0+1,i0+2,0,1,0);return;}
   let convex=true,sg=0;for(let i=0;i<n&&convex;i++){const a=R[i],b=R[(i+1)%n],c=R[(i+2)%n],cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(abs(cr)<1e-6)continue;if(!sg)sg=Math.sign(cr);else if(Math.sign(cr)!==sg)convex=false;}
   if(convex){for(let i=1;i<n-1;i++)triO(J,i0,i0+i,i0+i+1,0,1,0);return;}
   _v2.length=0;for(const q of R)_v2.push(new THREE.Vector2(q[0],q[1]));let f;try{f=THREE.ShapeUtils.triangulateShape(_v2,[]);}catch(e){f=[];}
   for(const t of f)triO(J,i0+t[0],i0+t[1],i0+t[2],0,1,0);}
 function dome(J,cx,cz,y,R,col){const S=10,Rg=3,i0=J.P.length/3;
   for(let r=0;r<=Rg;r++){const ph=r/Rg*PI/2,rr=R*cos(ph),yy=y+R*0.92*sin(ph);if(r===Rg){emit(J,cx,yy,cz,0,0,col);break;}for(let s=0;s<S;s++){const a=s/S*2*PI;emit(J,cx+rr*cos(a),yy,cz+rr*sin(a),0,0,col);}}
   const top=i0+Rg*S;for(let r=0;r<Rg;r++)for(let s=0;s<S;s++){const a=i0+r*S+s,b=i0+r*S+(s+1)%S;
     if(r===Rg-1){triO(J,a,b,top,J.P[a*3]-cx*10,1,J.P[a*3+2]-cz*10);}else{const c=a+S,d=b+S;const hx=J.P[a*3]-cx*10,hz=J.P[a*3+2]-cz*10;triO(J,a,b,d,hx,0.5,hz);triO(J,a,d,c,hx,0.5,hz);}}}
 function spire(J,x,z,base,h,r,col,capCol){const R=[];for(let s=0;s<6;s++){const a=s/6*2*PI;R.push([x+r*cos(a),z+r*sin(a)]);}prism(J,R,base,base+h,col,false);
   const i0=J.P.length/3;for(const q of R)emit(J,q[0],base+h,q[1],0,0,capCol);const tp=emit(J,x,base+h+r*3.2,z,0,0,capCol);
   for(let s=0;s<6;s++)triO(J,i0+s,i0+(s+1)%6,tp,R[s][0]-x,0.3,R[s][1]-z);}
 const WHITE=[225,225,220],LEAD=OSMB.ROOF[5],SEAT=[[190,40,40],[40,70,160],[200,170,40],[60,120,70]].map(c=>c.map(v=>Math.round(255*Math.pow(v/255,2.2))));
 function building(J){const c=J.c,dv=c.dv;let o=J.off;const typ=dv.getUint8(o),h=dv.getUint16(o+2,true)/10,wc=dv.getUint8(o+4),rc=dv.getUint8(o+5),n=dv.getUint16(o+6,true);o+=8;
   _ring.length=0;let sx=0,sz=0;for(let i=0;i<n;i++){const x=dv.getInt16(o,true)/10,z=dv.getInt16(o+2,true)/10;o+=4;_ring.push([x,z]);sx+=x;sz+=z;}J.off=o;
   const mx=sx/n,mz=sz/n,wx=c.cx+mx,wz=c.cz+mz;if(skipAt(wx,wz))return;
   const wall=OSMB.WALL[wc%OSMB.WALL.length],rf=OSMB.ROOF[rc%OSMB.ROOF.length];
   if(typ===5||typ===6){ // city walls and aqueducts: a thick wall along the line, following the ground
     const t=typ===6?7:5;for(let i=0;i<n-1;i++){const a=_ring[i],b=_ring[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<0.5)continue;const px=-(b[1]-a[1])/L*t/2,pz=(b[0]-a[0])/L*t/2;
       const ga=gnd(c.cx+a[0],c.cz+a[1]),gb=gnd(c.cx+b[0],c.cz+b[1]),base=min(ga,gb)-2,top=max(ga,gb)+h*(typ===6?1:0.85+0.15*((i*7)%3));
       const R=[[a[0]+px,a[1]+pz],[b[0]+px,b[1]+pz],[b[0]-px,b[1]-pz],[a[0]-px,a[1]-pz]];prism(J,R,base,top,wall,false);roof(J,R,top,wall);}return;}
   let base=Infinity;for(const q of _ring)base=min(base,gnd(c.cx+q[0],c.cz+q[1]));base-=1.5;
   if(typ===4){ // stadium: outer wall, stands sloping down to the pitch
     const H=h,k=0.62,inner=_ring.map(q=>[mx+(q[0]-mx)*k,mz+(q[1]-mz)*k]),seat=SEAT[(wc+rc)%SEAT.length];prism(J,_ring,base,base+1.5+H,WHITE,false);
     const i0=J.P.length/3;for(let i=0;i<n;i++){emit(J,_ring[i][0],base+1.5+H,_ring[i][1],0,0,seat);emit(J,inner[i][0],base+5,inner[i][1],0,0,seat);}
     for(let i=0;i<n;i++){const a=i0+i*2,b=i0+((i+1)%n)*2;triO(J,a,b,b+1,0,1,0);triO(J,a,b+1,a+1,0,1,0);}return;}
   const top=base+1.5+h;prism(J,_ring,base,top,typ===2?WHITE:wall,typ!==2);roof(J,_ring,top,rf);
   if(typ===2){let A=0;for(let i=0;i<n;i++){const a=_ring[i],b=_ring[(i+1)%n];A+=a[0]*b[1]-b[0]*a[1];}A=abs(A)/2;
     const R=Math.min(0.36*Math.sqrt(A),15);if(R>2.5)dome(J,mx,mz,top,R,LEAD);
     if(A>120){let fi=0,fd=0;_ring.forEach((q,i)=>{const d=(q[0]-mx)**2+(q[1]-mz)**2;if(d>fd){fd=d;fi=i;}});
       const mh=max(18,h+R*2.6),spot=q=>[mx+(q[0]-mx)*0.9,mz+(q[1]-mz)*0.9];const s1=spot(_ring[fi]);spire(J,s1[0],s1[1],base,mh,1.5,WHITE,LEAD);
       if(A>900){const s2=[2*mx-s1[0],2*mz-s1[1]];spire(J,s2[0],s2[1],base,mh,1.5,WHITE,LEAD);}}}}
 function finishJob(J){const c=J.c;const g=new THREE.BufferGeometry();
   g.setAttribute('position',new THREE.Int16BufferAttribute(J.P,3));g.setAttribute('uv',new THREE.Int16BufferAttribute(J.U,2));g.setAttribute('color',new THREE.Uint8BufferAttribute(J.C,3,true));
   g.setIndex(J.P.length/3>65535?new THREE.Uint32BufferAttribute(J.I,1):new THREE.Uint16BufferAttribute(J.I,1));g.computeBoundingSphere();
   const m=new THREE.Mesh(g,OSMB.mat);m.position.set(c.cx,0,c.cz);m.scale.setScalar(0.1);m.castShadow=m.receiveShadow=false;m.userData.full=J.lod===2;
   if(c.mesh){scene.remove(c.mesh);c.mesh.geometry.dispose();}c.mesh=m;c.farIdx=J.farIdx===null?J.I.length:J.farIdx;scene.add(m);
   if(J.lod===2&&c.nTrees){const dv=c.dv,im=new THREE.InstancedMesh(OSMB.treeGeo,OSMB.treeMat,c.nTrees),m4=new THREE.Matrix4(),col=new THREE.Color();let o=J.off,k=0;
     for(let t=0;t<c.nTrees;t++){const x=dv.getInt16(o,true)/10,z=dv.getInt16(o+2,true)/10,s=dv.getUint8(o+4)/255;o+=5;const wx=c.cx+x,wz=c.cz+z;if(skipAt(wx,wz))continue;
       const sc=0.65+s*0.8;m4.makeScale(sc,sc*(0.85+((s*7)%1)*0.4),sc);m4.setPosition(wx,gnd(wx,wz)-0.5,wz);im.setMatrixAt(k,m4);col.setRGB(0.10+s*0.08,0.20+((s*13)%1)*0.10,0.07+s*0.04);im.setColorAt(k,col);k++;}
     im.count=k;im.computeBoundingSphere();im.castShadow=false;c.trees=im;scene.add(im);}
   c.have=J.lod;c.q=0;OSMB.tris+=J.I.length/3;}
 function tick(now){if(!OSMB.on)return;if(now-OSMB.t>500){OSMB.t=now;watch();}
   const t0=performance.now(),budget=frame.warm?0:3;
   while(performance.now()-t0<budget){
     if(!OSMB.job){const c=OSMB.queue.shift();if(!c)break;if(!c.q||c.have>=c.q){c.q=0;continue;}OSMB.job=startJob(c,c.q);}
     const J=OSMB.job;for(let s=0;s<40&&J.k<J.n;s++,J.k++){if(J.k===J.c.nFar)J.farIdx=J.I.length;building(J);}
     if(J.k>=J.n){finishJob(J);OSMB.job=null;}}}
 OSMB.reset=()=>{OSMB.cells.forEach(c=>{dropCell(c);c.q=0;});OSMB.queue.length=0;OSMB.job=null;OSMB.t=0;};
 osmCity={tick,OSMB};

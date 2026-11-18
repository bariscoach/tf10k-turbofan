// Round engine instruments, drawn like the real thing: a brushed-metal bezel, a black dial lit from above, white ticks and
// figures, amber and red caution arcs, a tapered needle with a soft shadow over a metal hub, a digital window, and a curved
// glass reflection. The static face is drawn once into an offscreen canvas; each frame only the needle, the window and the
// glass are drawn over it. The needle eases towards the value like a damped instrument movement, and nothing is redrawn while
// it hasn't visibly moved.
class Gauge{constructor(id,o){this.c=$(id);this.ctx=this.c.getContext('2d');this.o=o;this.v=null;this.face=null;}
  geom(W,H){const S=min(W,H);return{S,cx:W/2,cy:H/2,Rb:S*0.48,Rf:S*0.415,R:S*0.33};}
  ang(x){const o=this.o;return 0.75*PI+1.5*PI*clamp((x-o.min)/(o.max-o.min),0,1);}
  drawFace(pw,ph,dpr,W,H){const o=this.o,cv=document.createElement('canvas');cv.width=pw;cv.height=ph;const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    const {S,cx,cy,Rb,Rf,R}=this.geom(W,H);
    // bezel: brushed metal, lit from the top, with a dark inner lip
    let gr=g.createLinearGradient(cx,cy-Rb,cx,cy+Rb);gr.addColorStop(0,'#9aa1aa');gr.addColorStop(0.45,'#4c535b');gr.addColorStop(1,'#1d2125');
    g.fillStyle=gr;g.beginPath();g.arc(cx,cy,Rb,0,2*PI);g.fill();
    g.fillStyle='#0b0d10';g.beginPath();g.arc(cx,cy,Rf+S*0.022,0,2*PI);g.fill();
    // dial: black, a little lighter towards the top as if lit by the cockpit
    gr=g.createRadialGradient(cx,cy-Rf*0.45,Rf*0.1,cx,cy,Rf);gr.addColorStop(0,'#232a31');gr.addColorStop(1,'#07090b');g.fillStyle=gr;g.beginPath();g.arc(cx,cy,Rf,0,2*PI);g.fill();
    // caution and limit arcs
    const band=(a,b,col)=>{g.strokeStyle=col;g.lineWidth=S*0.035;g.beginPath();g.arc(cx,cy,R*1.06,this.ang(a),this.ang(b));g.stroke();};
    if(o.amber<o.max)band(o.amber,min(o.red,o.max),'#e7a32a');if(o.red<o.max)band(o.red,o.max,'#e0382c');
    // ticks and figures
    g.strokeStyle='#e9ecee';g.fillStyle='#e9ecee';g.textAlign='center';g.textBaseline='middle';g.font=`600 ${max(7,Math.round(S*0.105))}px ${FONT_MONO}`;
    const fe=o.every*(S<110?2:1);   // small dials carry fewer figures, as real ones do
    for(let t=o.min,i=0;t<=o.max+1e-6;t+=o.tick,i++){const a=this.ang(t),maj=i%o.every===0,r0=R*(maj?0.9:0.96);g.lineWidth=maj?max(1.2,S*0.018):max(0.8,S*0.01);
      g.beginPath();g.moveTo(cx+cos(a)*r0,cy+sin(a)*r0);g.lineTo(cx+cos(a)*R*1.12,cy+sin(a)*R*1.12);g.stroke();
      if(i%fe===0)g.fillText(o.tl?o.tl(t):String(t),cx+cos(a)*R*0.68,cy+sin(a)*R*0.68);}
    // name and unit in the free space at the bottom of the dial, where the needle never goes
    g.fillStyle='#cfd6dc';g.font=`700 ${max(7,Math.round(S*0.1))}px ${FONT_DISP}`;g.fillText(o.label+(o.unit?' '+o.unit:''),cx,cy+R*0.98);
    // digital window (the value is written into it each frame)
    const ww=R*1.02,wh=S*0.15;g.fillStyle='#020304';g.strokeStyle='#3a434d';g.lineWidth=1;g.beginPath();if(g.roundRect)g.roundRect(cx-ww/2,cy+R*0.24,ww,wh,2);else g.rect(cx-ww/2,cy+R*0.24,ww,wh);g.fill();g.stroke();
    return cv;}
  draw(target){const {c,ctx,o}=this;this.v=this.v==null?target:this.v+(target-this.v)*0.22;const v=this.v;
    const dpr=min(window.devicePixelRatio||1,2),[sw,sh]=sizeOf(c),W=sw||86,H=sh||86;
    const key=Math.round((v-o.min)/(o.max-o.min)*700)+'|'+o.fmt(target)+'|'+W+'x'+H;if(key===this.k)return;this.k=key;   // skip redraws while nothing visible changed
    const pw=Math.round(W*dpr),ph=Math.round(H*dpr);if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph;this.face=null;}
    if(!this.face)this.face=this.drawFace(pw,ph,dpr,W,H);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,pw,ph);ctx.drawImage(this.face,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    const {S,cx,cy,Rf,R}=this.geom(W,H);
    // digital value
    const col=target>=o.red?'#ff5347':target>=o.amber?'#ffb432':'#e9ecee';ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${max(7,Math.round(S*0.115))}px ${FONT_MONO}`;
    ctx.fillText(o.fmt(target),cx,cy+R*0.24+S*0.077);
    // needle: tapered, with a soft shadow cast onto the dial
    const a=this.ang(v),ca=cos(a),sa=sin(a),nx=-sa,ny=ca,w=S*0.022,tip=R*1.02,tail=R*0.22;
    ctx.save();ctx.shadowColor='rgba(0,0,0,0.65)';ctx.shadowBlur=S*0.03;ctx.shadowOffsetX=S*0.012;ctx.shadowOffsetY=S*0.02;
    ctx.fillStyle='#f4f1e8';ctx.beginPath();ctx.moveTo(cx+ca*tip,cy+sa*tip);ctx.lineTo(cx+nx*w,cy+ny*w);ctx.lineTo(cx-ca*tail+nx*w*0.6,cy-sa*tail+ny*w*0.6);ctx.lineTo(cx-ca*tail-nx*w*0.6,cy-sa*tail-ny*w*0.6);ctx.lineTo(cx-nx*w,cy-ny*w);ctx.closePath();ctx.fill();ctx.restore();
    // hub
    const hg=ctx.createRadialGradient(cx-S*0.012,cy-S*0.014,S*0.004,cx,cy,S*0.045);hg.addColorStop(0,'#c9ced3');hg.addColorStop(1,'#2a2f35');ctx.fillStyle=hg;ctx.beginPath();ctx.arc(cx,cy,S*0.042,0,2*PI);ctx.fill();
    // glass: a curved reflection across the upper left of the dial
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,Rf,0,2*PI);ctx.clip();const gl=ctx.createLinearGradient(cx-Rf,cy-Rf,cx+Rf*0.2,cy+Rf*0.2);gl.addColorStop(0,'rgba(255,255,255,0.16)');gl.addColorStop(0.5,'rgba(255,255,255,0.04)');gl.addColorStop(0.51,'rgba(255,255,255,0)');
    ctx.fillStyle=gl;ctx.beginPath();ctx.ellipse(cx-Rf*0.25,cy-Rf*0.35,Rf*1.05,Rf*0.7,-0.6,0,2*PI);ctx.fill();ctx.restore();}}

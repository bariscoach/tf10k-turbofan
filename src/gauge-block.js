class Gauge{constructor(id,o){this.c=$(id);this.ctx=this.c.getContext('2d');this.o=o;}
  draw(v){const {c,ctx,o}=this;const dpr=min(window.devicePixelRatio||1,2);const [sw,sh]=sizeOf(c),W=sw||160,H=sh||147;const key=Math.round(v*10)+'|'+W+'x'+H;if(key===this.k)return;this.k=key;   // skip unchanged redrawsconst pw=Math.round(W*dpr),ph=Math.round(H*dpr);if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
    const cx=W/2,cy=H*0.54,R=min(W*0.34,H*0.36);const a0=0.75*PI,a1=2.25*PI;const f=x=>a0+(a1-a0)*clamp((x-o.min)/(o.max-o.min),0,1);
    const col=v>=o.red?C.red:v>=o.amber?C.amber:C.cyan;
    ctx.lineWidth=R*0.15;ctx.strokeStyle=C.line;ctx.beginPath();ctx.arc(cx,cy,R,a0,a1);ctx.stroke();
    if(o.amber<o.max){ctx.globalAlpha=.45;ctx.strokeStyle=C.amber;ctx.beginPath();ctx.arc(cx,cy,R,f(o.amber),f(min(o.red,o.max)));ctx.stroke();}
    if(o.red<o.max){ctx.globalAlpha=.6;ctx.strokeStyle=C.red;ctx.beginPath();ctx.arc(cx,cy,R,f(o.red),a1);ctx.stroke();}
    ctx.globalAlpha=1;ctx.strokeStyle=col;ctx.beginPath();ctx.arc(cx,cy,R,a0,f(v));ctx.stroke();
    ctx.strokeStyle=C['fg-dim'];ctx.fillStyle=C['fg-dim'];ctx.lineWidth=1.2;ctx.font=`500 ${Math.round(R*0.2)}px ${FONT_MONO}`;ctx.textAlign='center';ctx.textBaseline='middle';
    for(let t=o.min,i=0;t<=o.max+1e-6;t+=o.tick,i++){const a=f(t);ctx.beginPath();ctx.moveTo(cx+cos(a)*R*1.12,cy+sin(a)*R*1.12);ctx.lineTo(cx+cos(a)*R*(i%o.every?1.18:1.24),cy+sin(a)*R*(i%o.every?1.18:1.24));ctx.stroke();
      if(i%o.every===0)ctx.fillText(o.tl?o.tl(t):String(t),cx+cos(a)*R*1.42,cy+sin(a)*R*1.42);}
    const a=f(v);ctx.strokeStyle=C.fg;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(cx+cos(a)*R*0.62,cy+sin(a)*R*0.62);ctx.lineTo(cx+cos(a)*R*1.04,cy+sin(a)*R*1.04);ctx.stroke();
    ctx.fillStyle=col;ctx.font=`600 ${Math.round(R*0.5)}px ${FONT_MONO}`;ctx.fillText(o.fmt(v),cx,cy-R*0.04);
    ctx.fillStyle=C.fg;ctx.font=`700 ${Math.round(R*0.3)}px ${FONT_DISP}`;ctx.fillText(o.label,cx,cy+R*0.46);
    ctx.fillStyle=C['fg-dim'];ctx.font=`600 ${Math.round(R*0.22)}px ${FONT_DISP}`;ctx.fillText(o.unit,cx,cy+R*0.78);}}

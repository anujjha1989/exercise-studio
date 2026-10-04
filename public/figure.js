"use strict";
/* Pictogram renderer: white figures on a coloured tile, working muscles in yellow. */
const FIG={body:"#FFFFFF",far:"rgba(255,255,255,.5)",floor:"rgba(255,255,255,.4)",bell:"#0F1B3D",hl:"#FFE14A"};
const lp=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
function fullPose(p,ex){
  const a2=p.a2||(ex.mir?p.a.map(q=>[2*p.n[0]-q[0],q[1]]):p.a);
  const l2=p.l2||(ex.mir?p.l.map(q=>[2*p.p[0]-q[0],q[1]]):p.l);
  return {n:p.n,p:p.p,a:p.a,a2,l:p.l,l2};
}
const beat=ex=>ex.slow?1.6:ex.fast?0.38:0.95;
function poseAt(ex,t){
  const n=ex.poses.length,u=(t/beat(ex))%n,i=Math.floor(u),f=0.5-0.5*Math.cos(Math.PI*(u-i));
  const A=fullPose(ex.poses[i],ex),B=fullPose(ex.poses[(i+1)%n],ex),o={};
  o.n=lp(A.n,B.n,f);o.p=lp(A.p,B.p,f);
  for(const k of ["a","a2","l","l2"])o[k]=[lp(A[k][0],B[k][0],f),lp(A[k][1],B[k][1],f)];
  return o;
}
function drawFig(cv,ex,t,hl){
  const dpr=Math.min(window.devicePixelRatio||1,2),cw=cv.clientWidth||120,ch=cv.clientHeight||100;
  if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr)}
  const c=cv.getContext("2d"),s=Math.min(cv.width/120,cv.height/100);
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cv.width,cv.height);
  c.setTransform(s,0,0,s,(cv.width-120*s)/2,(cv.height-100*s)/2);
  c.lineCap="round";c.lineJoin="round";
  const line=(pts,col,w)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.stroke()};
  line([[4,94],[116,94]],FIG.floor,1.6);
  if(ex.prop&&ex.prop.chair){const x=ex.prop.chair[0],bx=ex.prop.chair[1]==="r"?x+22:x+2;
    line([[x,71],[x+24,71]],FIG.far,3);line([[x+3,71],[x+3,93]],FIG.far,3);line([[x+21,71],[x+21,93]],FIG.far,3);line([[bx,93],[bx,44]],FIG.far,3)}
  if(ex.prop&&ex.prop.wall)line([[ex.prop.wall,8],[ex.prop.wall,93]],FIG.far,3);
  const P=poseAt(ex,t),W=6.6,g=hl?ex.g:null;
  const bell=h=>{line([[h[0]-5,h[1]],[h[0]+5,h[1]]],FIG.bell,2.6);c.fillStyle=FIG.bell;c.fillRect(h[0]-7.5,h[1]-3.6,3.2,7.2);c.fillRect(h[0]+4.3,h[1]-3.6,3.2,7.2)};
  line([P.p,P.l2[0],P.l2[1]],FIG.far,W);line([P.n,P.a2[0],P.a2[1]],FIG.far,W);
  if(ex.db&&ex.mir)bell(P.a2[1]);
  line([P.n,P.p],FIG.body,W+1.4);
  const dx=P.n[0]-P.p[0],dy=P.n[1]-P.p[1],m=Math.hypot(dx,dy)||1;
  c.fillStyle=FIG.body;c.beginPath();c.arc(P.n[0]+dx/m*9.4,P.n[1]+dy/m*9.4,6,0,7);c.fill();
  line([P.p,P.l[0],P.l[1]],FIG.body,W);line([P.n,P.a[0],P.a[1]],FIG.body,W);
  if(g){
    const mid=lp(P.n,P.p,0.5);
    if(g==="chest"||g==="back")line([P.n,mid],FIG.hl,W+1.4);
    if(g==="core")line([mid,P.p],FIG.hl,W+1.4);
    if(g==="arms"){line([P.n,P.a[0],P.a[1]],FIG.hl,W);if(ex.mir)line([P.n,P.a2[0],P.a2[1]],FIG.hl,W)}
    if(g==="shoulders"){line([P.n,lp(P.n,P.a[0],0.6)],FIG.hl,W+1);if(ex.mir)line([P.n,lp(P.n,P.a2[0],0.6)],FIG.hl,W+1)}
    if(g==="legs"){line([P.p,P.l[0],P.l[1]],FIG.hl,W);if(ex.mir)line([P.p,P.l2[0],P.l2[1]],FIG.hl,W)}
  }
  if(ex.db)bell(P.a[1]);
}
const STILL=matchMedia("(prefers-reduced-motion: reduce)").matches;
function figLoop(ms){
  const vh=innerHeight;
  document.querySelectorAll("canvas[data-ex]").forEach(cv=>{
    const r=cv.getBoundingClientRect();
    if(r.width===0||r.bottom<0||r.top>vh)return;
    const ex=exById(cv.dataset.ex);if(!ex)return;
    const sp=cv.dataset.slow?0.3:1;
    drawFig(cv,ex,STILL&&!cv.dataset.play?0.5*beat(ex):ms/1000*sp,!!cv.dataset.hl);
  });
  requestAnimationFrame(figLoop);
}

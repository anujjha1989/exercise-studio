"use strict";
/* Anatomical demo figures: shaded grey body on a white stage, working muscles in red,
   helper muscles in salmon, black dumbbells and bench. Built on the pose skeleton in data.js. */
const PAL={skin:["#F4F5F7","#CDD2D8","#8E959E"],red:["#FF9A7D","#E8452C","#A32A19"],sal:["#FCE0D6","#F4B09C","#C98672"],
  dark:"#1A1D22",hair:"#2B2E34",line:"#555C66",prop:"#1A1D22",propLeg:"#B9BEC6",floor:"#D9DDE3",mat:"#4F7FE0"};
const PARTS={chest:["chest"],back:["back"],shoulders:["delt"],arms:["uarm"],core:["core"],legs:["thigh"],cardio:[]};
const lp=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
const add=(a,b,k)=>[a[0]+b[0]*k,a[1]+b[1]*k];
const unit=(a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],m=Math.hypot(x,y)||1;return [x/m,y/m]};
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
  const c=cv.getContext("2d"),s=Math.min(cv.width/120,cv.height/104);
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cv.width,cv.height);
  c.setTransform(s,0,0,s,(cv.width-120*s)/2,(cv.height-104*s)/2+4*s);
  c.lineCap="round";c.lineJoin="round";
  const pri=new Set(hl?PARTS[ex.g]||[]:[]),sec=new Set();
  if(hl){(ex.also||[]).forEach(g=>(PARTS[g]||[]).forEach(p=>sec.add(p)));if(ex.g==="arms"&&ex.mv==="pull")sec.add("farm")}
  const tone=part=>pri.has(part)?PAL.red:sec.has(part)?PAL.sal:PAL.skin;
  const grad=(a,b,r)=>{const g=c.createLinearGradient(a[0],a[1],b[0],b[1]);g.addColorStop(0,r[2]);g.addColorStop(0.3,r[0]);g.addColorStop(0.72,r[1]);g.addColorStop(1,r[2]);return g};
  const finish=(fill,far)=>{c.fillStyle=fill;c.fill();if(far){c.fillStyle="rgba(70,76,86,.3)";c.fill()}c.strokeStyle=PAL.line;c.lineWidth=0.55;c.stroke()};
  // one tapered muscle segment from A to B with half-widths at start, belly and end
  const seg=(A,B,wA,wM,wB,fill,far)=>{
    const u=unit(A,B),n=[-u[1],u[0]],M=lp(A,B,0.42),ang=Math.atan2(n[1],n[0]),k=2*wM-(wA+wB)/2;
    c.beginPath();c.moveTo(A[0]+n[0]*wA,A[1]+n[1]*wA);
    c.quadraticCurveTo(M[0]+n[0]*k,M[1]+n[1]*k,B[0]+n[0]*wB,B[1]+n[1]*wB);
    c.arc(B[0],B[1],wB,ang,ang-Math.PI,true);
    c.quadraticCurveTo(M[0]-n[0]*k,M[1]-n[1]*k,A[0]-n[0]*wA,A[1]-n[1]*wA);
    c.arc(A[0],A[1],wA,ang+Math.PI,ang,true);c.closePath();
    finish(typeof fill==="string"?fill:grad(add(M,n,-wM),add(M,n,wM),fill),far);
  };
  const blob=(pts,fill,far)=>{
    const m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],n=pts.length,s0=m(pts[0],pts[1]);
    c.beginPath();c.moveTo(s0[0],s0[1]);
    for(let i=1;i<=n;i++){const p=pts[i%n],q=m(p,pts[(i+1)%n]);c.quadraticCurveTo(p[0],p[1],q[0],q[1])}
    c.closePath();finish(fill,far);
  };
  const oval=(ctr,ax,rx,ry,ramp)=>{c.beginPath();c.ellipse(ctr[0],ctr[1],rx,ry,Math.atan2(ax[1],ax[0]),0,7);
    const n=[-ax[1],ax[0]];finish(grad(add(ctr,n,-ry),add(ctr,n,ry),ramp))};

  // floor and props
  c.strokeStyle=PAL.floor;c.lineWidth=1.4;c.beginPath();c.moveTo(4,94.5);c.lineTo(116,94.5);c.stroke();
  if(ex._mat===undefined)ex._mat=ex.poses.some(q=>q.p[1]>=78||q.a[1][1]>=86);
  if(ex._mat){c.fillStyle=PAL.mat;c.beginPath();c.roundRect(6,93.2,108,3.4,1.7);c.fill()}
  if(ex.prop&&ex.prop.chair){const x=ex.prop.chair[0],bx=ex.prop.chair[1]==="r"?x+22:x+2;
    c.strokeStyle=PAL.propLeg;c.lineWidth=2.4;c.beginPath();c.moveTo(x+3,72);c.lineTo(x+3,94);c.moveTo(x+21,72);c.lineTo(x+21,94);c.moveTo(bx,94);c.lineTo(bx,46);c.stroke();
    c.strokeStyle=PAL.prop;c.lineWidth=3.6;c.beginPath();c.moveTo(x-1,72);c.lineTo(x+25,72);c.stroke()}
  if(ex.prop&&ex.prop.wall){c.strokeStyle=PAL.propLeg;c.lineWidth=3;c.beginPath();c.moveTo(ex.prop.wall-3,6);c.lineTo(ex.prop.wall-3,94);c.stroke()}

  const P=poseAt(ex,t),fv=!!(ex.mir||ex.front),fl=ex.flip?-1:1;
  const d=unit(P.n,P.p),R=[-d[1],d[0]],F=[d[1]*fl,-d[0]*fl],L=Math.hypot(P.p[0]-P.n[0],P.p[1]-P.n[1]);
  const at=(tt,off,dir)=>add(add(P.n,d,L*tt),dir||F,off||0);
  // front view: spread the arms to the shoulders
  const shift=(pts,sg)=>fv?[[pts[0][0]+5*sg,pts[0][1]],[Math.abs(pts[1][0]-P.n[0])<5?pts[1][0]:pts[1][0]+5*sg,pts[1][1]]]:pts;
  const sideA=fv?(P.a[0][0]<=P.a2[0][0]?-1:1):0;
  const A1=shift(P.a,sideA),A2=shift(P.a2,-sideA);
  const sh1=fv?add(at(0.1),[1,0],9.4*sideA):at(0.09),sh2=fv?add(at(0.1),[1,0],-9.4*sideA):at(0.09);
  const sideL=fv?(P.l[0][0]<=P.l2[0][0]?-1:1):0;
  const hp1=fv?add(P.p,[1,0],4.4*sideL):P.p,hp2=fv?add(P.p,[1,0],-4.4*sideL):P.p;

  const bell=h=>{c.strokeStyle="#6E747D";c.lineWidth=1.6;c.beginPath();c.moveTo(h[0]-6,h[1]);c.lineTo(h[0]+6,h[1]);c.stroke();
    c.fillStyle=PAL.dark;[-7.4,3.6].forEach(o=>{c.beginPath();c.roundRect(h[0]+o,h[1]-4.6,3.8,9.2,1.2);c.fill()});
    c.strokeStyle="rgba(255,255,255,.35)";c.lineWidth=0.5;[-6.2,4.8].forEach(o=>{c.beginPath();c.moveTo(h[0]+o,h[1]-3);c.lineTo(h[0]+o,h[1]+3);c.stroke()})};
  const leg=(hip,pts,far)=>{
    const k=pts[0],f=pts[1],sv=unit(k,f),fd=fv?[0,1]:[sv[1]*fl,-sv[0]*fl];
    seg(k,f,3.7,4.6,2.4,PAL.skin,far);                                   // calf
    seg(f,add(f,fd,fv?2.2:5.4),2.3,2.3,1.9,PAL.skin,far);                // foot
    seg(hip,k,5.4,6.3,4,tone("thigh"),far);                            // thigh
    seg(hip,lp(hip,k,0.3),5.5,5.8,5.6,PAL.dark);                        // shorts leg
  };
  const arm=(sh,pts,far)=>{
    const e=pts[0],h=pts[1];
    seg(e,h,2.9,3.5,2.1,tone("farm"),far);                               // forearm
    c.beginPath();c.arc(h[0],h[1],2.4,0,7);finish(PAL.skin[1],far);      // hand
    seg(sh,e,3.6,4.5,3,tone("uarm"),far);                              // upper arm
    c.beginPath();c.arc(sh[0],sh[1],4.2,0,7);                            // deltoid
    finish(grad(add(sh,R,-4.2),add(sh,R,4.2),tone("delt")),far);
  };

  leg(hp2,P.l2,true);arm(sh2,A2,true);
  if(ex.db&&fv)bell(A2[1]);

  // torso
  if(fv){
    const W=[[-0.02,5.2],[0.1,10.6],[0.32,9.6],[0.66,7],[0.9,8.4],[1.04,7.4]];
    blob(W.map(w=>at(w[0],w[1],R)).concat(W.slice().reverse().map(w=>at(w[0],-w[1],R))),grad(at(0.4,-10,R),at(0.4,10,R),PAL.skin));
    [-1,1].forEach(sg=>oval(at(0.36,7.6*sg,R),d,L*0.17,2.2,tone("back")));          // lats
    [-1,1].forEach(sg=>oval(at(0.25,4.5*sg,R),R,4.3,L*0.125,tone("chest")));        // pecs
    blob([at(0.44,-3.3,R),at(0.44,3.3,R),at(0.84,2.8,R),at(0.84,-2.8,R)],grad(at(0.6,-3.3,R),at(0.6,3.3,R),tone("core")));
    c.strokeStyle=PAL.line;c.lineWidth=0.45;c.beginPath();
    [0.55,0.66,0.76].forEach(tt=>{const a=at(tt,-2.6,R),b=at(tt,2.6,R);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])});
    const a=at(0.46,0,R),b=at(0.83,0,R);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();
    blob([at(0.85,-8,R),at(0.85,8,R),at(1.05,7.6,R),at(1.05,-7.6,R)],PAL.dark);            // shorts
  }else{
    const W=[[-0.02,3.5,3.3],[0.12,5.8,5.6],[0.3,6,8.3],[0.62,4.6,5.4],[0.86,5.2,5.5],[1.04,4.8,4.8]];
    blob(W.map(w=>at(w[0],w[2])).concat(W.slice().reverse().map(w=>at(w[0],-w[1]))),grad(at(0.4,-6),at(0.4,7.5),PAL.skin));
    oval(at(0.36,-2.7),d,L*0.25,2.7,tone("back"));                                   // lat
    oval(at(0.27,3.4),d,L*0.16,3.5,tone("chest"));                                   // pec
    oval(at(0.66,2.3),d,L*0.19,2.6,tone("core"));                                    // abs
    c.strokeStyle=PAL.line;c.lineWidth=0.45;c.beginPath();
    [0.6,0.68,0.76].forEach(tt=>{const a=at(tt,0.6),b=at(tt,4.4);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])});c.stroke();
    blob([at(0.86,-5.3),at(0.86,5.6),at(1.05,5),at(1.05,-5)],PAL.dark);          // shorts
  }
  // neck and head
  const hc=add(P.n,d,-10.2);seg(at(0.02),add(P.n,d,-5),3,2.9,2.7,PAL.skin);
  c.save();c.translate(hc[0],hc[1]);c.rotate(Math.atan2(d[1],d[0]));
  c.beginPath();c.ellipse(0,0,6.2,5.1,0,0,7);finish(grad([0,-5.1],[0,5.1],PAL.skin));
  c.beginPath();c.ellipse(0,0,6.2,5.1,0,0,7);c.clip();c.fillStyle=PAL.hair;c.fillRect(-7,-6,5.2,12);
  if(!fv)c.fillRect(-7,fl>0?1.6:-6,10,4.4);
  c.restore();

  leg(hp1,P.l,false);arm(sh1,A1,false);
  if(ex.db)bell(A1[1]);
}
const STILL=matchMedia("(prefers-reduced-motion: reduce)").matches;
function figLoop(ms){
  const vh=innerHeight;
  document.querySelectorAll("canvas[data-ex]").forEach(cv=>{
    const r=cv.getBoundingClientRect();
    if(r.width===0||r.bottom<0||r.top>vh)return;
    const ex=exById(cv.dataset.ex);if(!ex)return;
    const sp=cv.dataset.slow?0.3:1;
    drawFig(cv,ex,STILL&&!cv.dataset.play?0.5*beat(ex):ms/1000*sp,cv.dataset.hl!=="0");
  });
  requestAnimationFrame(figLoop);
}

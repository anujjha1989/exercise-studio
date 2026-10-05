/* Exercise poses lifted into a consistent 3D frame. Floor is y=0, front is z.
   Shared with tests; no GPU/browser dependency. */
(function(root){
  'use strict';
  const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
  function full(p,e){return {...p,a2:p.a2||(e.mir?p.a.map(q=>[2*p.n[0]-q[0],q[1]]):p.a),l2:p.l2||(e.mir?p.l.map(q=>[2*p.p[0]-q[0],q[1]]):p.l)}}
  const beat=e=>e.slow?1.6:e.fast?0.38:0.95;
  function interpolate(e,time){
    const u=Math.max(0,time)/beat(e)%e.poses.length,i=Math.floor(u),f=(1-Math.cos(Math.PI*(u-i)))/2;
    const a=full(e.poses[i],e),b=full(e.poses[(i+1)%e.poses.length],e);
    return {n:mix(a.n,b.n,f),p:mix(a.p,b.p,f),a:a.a.map((q,k)=>mix(q,b.a[k],f)),a2:a.a2.map((q,k)=>mix(q,b.a2[k],f)),l:a.l.map((q,k)=>mix(q,b.l[k],f)),l2:a.l2.map((q,k)=>mix(q,b.l2[k],f))};
  }
  function skeleton(e,time){
    const p=interpolate(e,time),front=!!(e.mir||e.front),flip=e.flip?-1:1;
    const world=(q,side=0)=>front?[q[0]-60,90-q[1],side]:[side,90-q[1],(q[0]-60)*flip];
    const neck=world(p.n),hip=world(p.p),shoulder=mix(neck,hip,.1);
    const arms=[p.a,p.a2].map((points,i)=>{
      const sign=front?(p.a[0][0]<=p.a2[0][0]?-1:1)*(i?-1:1):(i?-1:1);
      const start=[shoulder[0]+sign*9.4,shoulder[1],shoulder[2]];
      return [start,world(points[0],front?0:sign*8),world(points[1],front?0:e.singleBell?0:sign*7)];
    });
    const legs=[p.l,p.l2].map((points,i)=>{
      const sign=front?(p.l[0][0]<=p.l2[0][0]?-1:1)*(i?-1:1):(i?-1:1);
      return [[hip[0]+sign*4.5,hip[1]-1,hip[2]],world(points[0],front?0:sign*4.8),world(points[1],front?0:sign*5.2)];
    });
    return {neck,hip,arms,legs,front,flip};
  }
  const api={interpolate,skeleton,beat};
  if(typeof module!=='undefined')module.exports=api;else root.FigureMath=api;
})(typeof window!=='undefined'?window:this);

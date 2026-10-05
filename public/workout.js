/* Shared workout rules. Browser and tests use this same source. */
(function(root){
  "use strict";
  function eligible(e,p){
    return !(e.eq==="db"&&!(p.hasDumbbells||p.dbs.length)) &&
      !(e.prop&&e.prop.chair&&!p.chair) &&
      !(p.experience==="beginner"&&e.level==="advanced") &&
      !(p.lowImpact&&e.impact==="high") && !(p.excluded||[]).includes(e.id);
  }
  function setCount(day,id){
    const e=(day.entries||[]).find(e=>e.ex===id);
    if(!e)return 0;
    if(e.sets.some(s=>s.side)||day.plan&&day.plan.unilateral&&day.plan.unilateral.includes(id)){
      // Older sets counted per side: retain them as paired sets.
      const paired=e.sets.filter(s=>!s.side).length;
      return paired+Math.min(e.sets.filter(s=>s.side==="left").length,e.sets.filter(s=>s.side==="right").length);
    }
    return e.sets.length;
  }
  function status(day){
    if(!day||(day.entries||[]).every(e=>!e.sets.length))return day&&day.started?"started":"cancelled";
    if(day.plan&&day.plan.ids.length){
      return day.plan.ids.every(id=>setCount(day,id)>=day.plan.sets)?"completed":"partial";
    }
    // Do not silently infer completion from old or manually logged records.
    return day.completed?"completed":"partial";
  }
  function elapsed(p,now=Date.now()){
    return Math.max(0,(p.pausedAt||now)-p.t0-(p.pausedMs||0));
  }
  function estimatedMinutes(count,sets,rest){return Math.ceil((180+count*sets*(40+rest))/60);}
  function fitTime(list,profile,scheme){
    let remaining=profile.minutes*60-180;
    return list.filter(e=>{const seconds=scheme.sets*(40+scheme.rest)*(e.unilateral?2:1);if(seconds>remaining)return false;remaining-=seconds;return true});
  }
  function trend(days,id){
    return Object.keys(days).sort().flatMap(d=>{
      const entries=days[d].entries.filter(e=>e.ex===id),sets=entries.flatMap(e=>e.sets);
      if(!sets.length)return [];
      const weighted=sets.some(s=>s.kg>0),timed=sets.some(s=>s.s>0);
      // Display a measured best set, not an estimated one-rep maximum.
      const best=sets.slice().sort((a,b)=>weighted?(b.kg||0)-(a.kg||0)||(b.r||0)-(a.r||0):timed?(b.s||0)-(a.s||0):(b.r||0)-(a.r||0))[0];
      return [{d,v:weighted?best.kg:timed?best.s:best.r,r:best.r,unit:weighted?"kg":timed?"s":"reps"}];
    });
  }
  function weightTrend(points){
    return points.slice().sort((a,b)=>a.d.localeCompare(b.d)).map(point=>{
      const end=Date.parse(point.d+"T00:00:00Z"),start=end-6*86400000;
      const window=points.filter(p=>{const t=Date.parse(p.d+"T00:00:00Z");return t>=start&&t<=end});
      return {d:point.d,v:Math.round(window.reduce((sum,p)=>sum+p.kg,0)/window.length*10)/10};
    });
  }
  const api={eligible,setCount,status,elapsed,estimatedMinutes,fitTime,trend,weightTrend};
  if(typeof module!=="undefined")module.exports=api;else root.Workout=api;
})(typeof window!=="undefined"?window:this);

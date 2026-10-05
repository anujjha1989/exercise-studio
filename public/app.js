"use strict";
/* ================= helpers ================= */
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const pd=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addD=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return ymd(d)};
const wdOf=s=>(pd(s).getDay()+6)%7;
const wk=s=>addD(s,-wdOf(s));
const nice=s=>pd(s).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
const short=s=>pd(s).toLocaleDateString(undefined,{day:"numeric",month:"short"});
let TODAY=ymd(new Date());
const WD=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=x=>Math.round(Math.max(0,Math.min(1,x||0))*100);
const mmss=s=>Math.floor(s/60)+":"+pad(Math.max(0,s)%60);
const $=id=>document.getElementById(id);
const main=$("main"),sheet=$("sheet"),playerEl=$("player");

/* ================= state + sync ================= */
const defProfile=()=>({set:false,goal:"muscle",focus:[],startKg:null,targetKg:null,days:[0,1,3,4],created:TODAY,weigh:[],measures:[],dbs:[],custom:[],swaps:{},experience:"beginner",minutes:45,chair:true,hasDumbbells:true,lowImpact:false,excluded:[]});
const S={profile:defProfile(),days:{}};
let D={profile:false,days:{}};
let online=false,syncing=false,storageError=false,editGeneration=0;
let revisions={profile:0,days:{}},conflicts={};
const LS="exercisestudio.v2",J={"Content-Type":"application/json"};
function fixProfile(p){
  const o=Object.assign(defProfile(),p||{});
  if(p&&!p.days&&p.weekly)o.days=({1:[0],2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,4,5],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]})[p.weekly]||[0,1,3,4];
  o.days=[...new Set(Array.isArray(o.days)?o.days:[0,2,4])].filter(d=>Number.isInteger(d)&&d>=0&&d<7).sort((a,b)=>a-b);if(!o.days.length)o.days=[0,2,4];
  for(const key of ["focus","weigh","measures","dbs","custom","excluded"])if(!Array.isArray(o[key]))o[key]=[];
  o.minutes=[15,20,30,45,60].includes(o.minutes)?o.minutes:45;
  if(!["beginner","experienced"].includes(o.experience))o.experience="beginner";
  return o;
}
function loadLocal(){try{const r=JSON.parse(localStorage.getItem(LS)||"null");if(r){S.profile=fixProfile(r.profile);S.days=r.days||{};D=r.dirty||D;revisions=r.revisions||revisions;conflicts=r.conflicts||{}}}catch(e){}}
function saveLocal(){try{localStorage.setItem(LS,JSON.stringify({profile:S.profile,days:S.days,dirty:D,revisions,conflicts}));storageError=false}catch(e){storageError=true}}
const pending=()=>(D.profile?1:0)+Object.keys(D.days).length;
function showSync(){
  const el=$("sync"),n=pending();
  el.className="sync "+(online&&!Object.keys(conflicts).length?"ok":"off");
  el.lastElementChild.textContent=storageError?"Device storage full — keep this page open":Object.keys(conflicts).length?"Save conflict — review below":online?(n?"Saving":"Saved on your Pi"):(n?n+" change"+(n>1?"s":"")+" waiting for the Pi":"Pi not reachable");
  const box=$("sync-notice");
  if(box)box.innerHTML=Object.entries(conflicts).map(([key,c])=>`<div class="banner stack" role="alert"><b>${key==="profile"?"Setup":nice(key)} changed on another device.</b><p>Your edits are still on this device. Download both versions before choosing which one to keep.</p><div class="row"><button class="btn line sm" data-act="conflict-download" data-key="${key}">Download both</button><button class="btn soft sm" data-act="conflict-pi" data-sure data-key="${key}">Use Pi version</button><button class="btn line sm" data-act="conflict-mine" data-sure data-key="${key}">Keep my version</button></div></div>`).join("");
}
async function writeVersion(key,body){
  const rev=key==="profile"?revisions.profile:(revisions.days[key]||0);
  const r=await fetch(key==="profile"?"api/profile":"api/days/"+key,{method:body?"PUT":"DELETE",headers:{...J,"If-Match":String(rev)},...(body?{body}:{})});
  if(r.status===409){conflicts[key]=await r.json();online=true;return false}
  if(!r.ok)throw Error("Save failed");
  const result=await r.json();
  if(key==="profile")revisions.profile=result.revision;else revisions.days[key]=result.revision;
  return true;
}
async function flush(){
  if(syncing)return;syncing=true;
  let retry=false;
  try{
    if(D.profile&&!conflicts.profile){const body=JSON.stringify(S.profile);if(await writeVersion("profile",body)){if(JSON.stringify(S.profile)===body)D.profile=false;else retry=true}}
    for(const k of Object.keys(D.days)){
      if(conflicts[k])continue;
      const body=S.days[k]?JSON.stringify(S.days[k]):null;
      if(await writeVersion(k,body)){if((S.days[k]?JSON.stringify(S.days[k]):null)===body)delete D.days[k];else retry=true}
    }
    online=true;
  }catch(e){online=false}
  syncing=false;saveLocal();showSync();
  if(online&&retry)flush();
}
function saveProfile(){editGeneration++;D.profile=true;saveLocal();flush()}
function saveDay(k){
  editGeneration++;
  const d=S.days[k];if(d&&!d.entries.length&&!d.min)delete S.days[k];
  D.days[k]=1;saveLocal();flush();
}
async function connect(){
  await flush();
  if(pending()){showSync();return}
  try{
    const generation=editGeneration;const r=await fetch("api/state");if(!r.ok)throw 0;const st=await r.json();
    if(generation!==editGeneration||pending())return;
    if(st.profile)S.profile=fixProfile(st.profile);
    S.days=st.days||{};revisions=st.revisions||{profile:0,days:{}};online=true;saveLocal();render();
  }catch(e){online=false}
  showSync();
}
setInterval(()=>{if(pending()||!online||!P&&!sheet.open&&!document.activeElement.matches("input,select,textarea"))connect()},20000);
addEventListener("online",connect);

/* ================= exercises ================= */
function exAll(){return EX.concat(S.profile.custom.map(c=>({id:c.id,name:c.name,g:c.g,mv:c.g,also:[],eq:c.eq,timed:c.timed?1:0,db:c.eq==="db"?1:0,custom:1,slow:1,poses:[ST,ST],steps:c.notes?[c.notes]:["Your own exercise. Add notes in Setup to remind yourself of the form."],tip:""})))}
function exById(id){return EX.find(e=>e.id===id)||exAll().find(e=>e.id===id)||null}
const exName=id=>{const e=exById(id);return e?e.name:"Removed exercise"};
const eqTxt=e=>(e.eq==="bw"?"Bodyweight":e.eq==="db"?"Dumbbells":"Bodyweight or dumbbells")+(e.prop&&e.prop.chair?" · sturdy chair":"")+(e.prop&&e.prop.wall?" · wall":"");
const setTxt=s=>(s.s?s.s+" s":(s.r+(s.kg?" × "+s.kg+" kg":"")))+(s.side?" · "+s.side:"");

/* ================= programme ================= */
const SCHEMES={lose:{sets:3,lo:12,hi:15,rest:30,hold:30,label:"Lose weight"},trim:{sets:3,lo:10,hi:15,rest:45,hold:35,label:"Body composition"},muscle:{sets:4,lo:8,hi:12,rest:75,hold:45,label:"Build muscle"}};
const scheme=()=>{const base=SCHEMES[S.profile.goal]||SCHEMES.muscle;return {...base,sets:S.profile.experience==="beginner"?2:base.sets}};
const playerScheme=()=>P&&P.plan?P.plan.scheme:scheme();
const TYPE={full:{n:"Full body",g:"full",s:"Full"},upper:{n:"Upper body",g:"chest",s:"Upper"},lower:{n:"Lower body",g:"legs",s:"Lower"},push:{n:"Push day",g:"arms",s:"Push"},pull:{n:"Pull day",g:"back",s:"Pull"},legs:{n:"Leg day",g:"legs",s:"Legs"}};
const SEQ={1:["full"],2:["full","full"],3:["full","full","full"],4:["upper","lower","upper","lower"],5:["push","pull","legs","upper","lower"],6:["push","pull","legs","push","pull","legs"],7:["push","pull","legs","push","pull","legs","full"]};
const SLOTS={full:["legs","chest","back","shoulders","legs","core"],upper:["chest","back","shoulders","arms:pull","arms:push","core"],lower:["legs","legs","legs","core","core","cardio"],
  push:["chest","chest","shoulders","shoulders","arms:push","core"],pull:["back","back","back","arms:pull","arms:pull","core"],legs:["legs","legs","legs","legs","core","cardio"]};
function buildSession(pos,date=TODAY){
  const p=S.profile,type=SEQ[p.days.length][pos],slots=SLOTS[type].slice();
  if(p.goal==="lose"){slots.splice(4,1);slots.push("cardio","cardio")}else if(p.goal==="trim")slots.push("cardio");
  p.focus.forEach(f=>{if(slots.length<8&&slots.some(s=>s.split(":")[0]===f))slots.push(f)});
  const block=Math.floor(Math.max(0,(pd(wk(date))-pd(wk(p.created)))/6048e5)/4),used=[],list=[],all=exAll().filter(e=>Workout.eligible(e,p));
  slots.forEach((s,i)=>{
    const [g,mv]=s.split(":"),pool=all.filter(e=>e.g===g&&(!mv||e.mv===mv)&&!used.includes(e.id));
    if(!pool.length)return;
    const key=type+pos+"-"+i,e=pool[(block*3+pos*2+i+(p.swaps[key]||0))%pool.length];
    used.push(e.id);list.push({id:e.id,key});
  });
  const sc=scheme();
  // Keep focus work inside the time budget rather than appending unreachable work.
  if(p.focus.length){const at=list.findIndex(x=>p.focus.includes(exById(x.id).g));if(at>0)list.unshift(...list.splice(at,1))}
  return {type,pos,name:TYPE[type].n,g:TYPE[type].g,list:Workout.fitTime(list.map(x=>({...exById(x.id),slot:x})),p,sc).map(e=>e.slot)};
}
function planFor(d){const pos=S.profile.days.indexOf(wdOf(d));return pos<0?null:buildSession(pos,d)}
function nextPlan(){for(let i=1;i<=7;i++){const d=addD(TODAY,i),s=planFor(d);if(s)return {d,s}}return null}

/* ================= derived numbers ================= */
const dayOf=k=>S.days[k]||(S.days[k]={date:k,min:0,entries:[]});
const curKg=()=>{const w=S.profile.weigh.filter(x=>x.d<=TODAY);return w.length?w[w.length-1].kg:S.profile.startKg};
const doneSets=(k,id)=>Workout.setCount(S.days[k]||{entries:[]},id);
const activityDays=()=>Object.keys(S.days).filter(k=>k<=TODAY&&S.days[k].entries.length).sort();
const statusLabel=d=>({completed:"Completed",partial:"Partial",started:"Started",cancelled:"Cancelled"})[Workout.status(d)];
function snapshotPlan(sess){const sc=scheme();return {name:sess.name,ids:sess.list.map(x=>x.id||x),sets:sc.sets,scheme:sc,unilateral:sess.list.map(x=>exById(x.id||x)).filter(e=>e&&e.unilateral).map(e=>e.id)}}
function dayStats(d){
  let sets=0,vol=0;
  d.entries.forEach(e=>e.sets.forEach(s=>{sets++;const ex=exById(e.ex);vol+=(s.r||0)*(s.kg||0)*(ex&&ex.eq==="db"&&!ex.singleBell&&!ex.unilateral?2:1)}));
  const min=d.min===undefined?Math.round(sets*1.5):d.min;
  return {sets,vol,min,kcal:null};
}
function groupSets(from){
  const g={};Object.keys(GROUPS).forEach(k=>g[k]=0);
  Object.keys(S.days).forEach(k=>{if(k<from||k>TODAY)return;S.days[k].entries.forEach(e=>{const ex=exById(e.ex);if(!ex)return;const sets=Workout.setCount(S.days[k],e.ex);g[ex.g]+=sets;ex.also.forEach(a=>g[a]+=sets*0.5)})});
  return g;
}
const sessionDays=()=>Object.keys(S.days).filter(k=>k<=TODAY&&Workout.status(S.days[k])==="completed").sort();
function weekCounts(n){
  const out=[],w0=wk(TODAY),by={};
  sessionDays().forEach(k=>{const w=wk(k);by[w]=(by[w]||0)+1});
  for(let i=n-1;i>=0;i--){const w=addD(w0,-7*i);out.push({w,c:by[w]||0})}
  return out;
}
function streak(){
  const t=S.profile.days.length,w=weekCounts(26).reverse();let n=0;
  for(let i=0;i<w.length;i++){if(w[i].c>=t)n++;else if(i>0)break}
  return n;
}
function journey(){
  const p=S.profile,cur=curKg();let wPct=null;
  if(p.startKg&&p.targetKg&&cur&&p.startKg!==p.targetKg)wPct=Math.max(0,Math.min(1,(p.startKg-cur)/(p.startKg-p.targetKg)));
  const start=wk(p.created),by={};
  sessionDays().forEach(k=>{const w=wk(k);if(w>=start&&w<addD(start,84))by[w]=(by[w]||0)+1});
  const weeksIn=Math.min(12,Math.round((pd(wk(TODAY))-pd(start))/6048e5)+1);
  return {wPct,weeksIn,hit:Math.min(12,Object.values(by).filter(c=>c>=p.days.length).length),cur};
}
function records(skip){
  const r={};
  Object.keys(S.days).sort().forEach(k=>{if(k===skip||k>TODAY)return;S.days[k].entries.forEach(e=>e.sets.forEach(s=>{
    let v,t;
    if(s.s){v=s.s;t=s.s+" s"}else if(s.kg){v=s.kg*(1+s.r/30);t=s.kg+" kg × "+s.r}else{v=s.r;t=s.r+" reps"}
    if(!r[e.ex]||v>r[e.ex].v)r[e.ex]={v,t,d:k};
  }))});
  return r;
}
function lastSets(id,before){
  const ks=Object.keys(S.days).filter(k=>k<before).sort().reverse();
  for(const k of ks){const sets=[];S.days[k].entries.forEach(e=>{if(e.ex===id)sets.push(...e.sets)});if(sets.length)return {d:k,sets}}
  return null;
}
function suggest(e,date){
  const sc=P?playerScheme():scheme(),L=lastSets(e.id,date),lastTxt=L?"Last time ("+short(L.d)+"): "+L.sets.map(setTxt).join(" · "):"";
  if(e.timed){const best=L?Math.max(...L.sets.map(s=>s.s||0)):0,t=best?Math.min(120,best+5):sc.hold;
    return {s:t,lastTxt,note:best?"Beat your "+best+" s: aim for "+t+" s.":"Start with "+t+" s."}}
  if(!L)return {r:sc.lo,kg:null,lastTxt,note:e.eq==="bw"?"Aim for "+sc.lo+" to "+sc.hi+" reps.":"Pick a weight you can lift "+sc.lo+" times with good form."};
  const kg=Math.max(...L.sets.map(s=>s.kg||0)),top=L.sets.filter(s=>(s.kg||0)===kg),minR=Math.min(...top.map(s=>s.r||0));
  if(kg>0){
    if(top.length>=sc.sets*(e.unilateral?2:1)&&minR>=sc.hi){
      const dbs=S.profile.dbs,up=dbs.filter(x=>x>kg).sort((a,b)=>a-b)[0]||(dbs.length?null:kg+1);
      if(up)return {r:sc.lo,kg:up,lastTxt,note:"You hit "+sc.hi+" reps on every set. Go up to "+up+" kg."};
      return {r:minR+1,kg,lastTxt,note:kg+" kg is your heaviest dumbbell. Take 3 seconds to lower each rep, or add a set."};
    }
    const r=Math.min(sc.hi,Math.max(sc.lo,minR+1));
    return {r,kg,lastTxt,note:"Stay at "+kg+" kg and aim for "+r+" reps each set."};
  }
  return {r:minR+1,kg:null,lastTxt,note:minR>=20?"Aim for "+(minR+1)+". Past 20 reps, move to a harder variation or add a dumbbell.":"Aim for "+(minR+1)+" reps each set."};
}

/* ================= rest timer + feedback ================= */
let actx=null;
function buzz(){
  try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();[0,0.22].forEach(t=>{const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=880;g.gain.value=0.16;o.connect(g);g.connect(actx.destination);o.start(actx.currentTime+t);o.stop(actx.currentTime+t+0.16)})}catch(e){}
  try{navigator.vibrate&&navigator.vibrate([220,120,220])}catch(e){}
}
const R={end:0,t:null,cb:null};
function startRest(sec,cb){R.end=Date.now()+sec*1000;R.cb=cb||null;clearInterval(R.t);R.t=setInterval(tickRest,250);tickRest()}
function stopRest(fire){clearInterval(R.t);R.t=null;R.end=0;$("restpill").hidden=true;const cb=R.cb;R.cb=null;if(fire&&cb)cb()}
function tickRest(){
  const left=Math.ceil((R.end-Date.now())/1000);
  if(left<=0){buzz();stopRest(true);return}
  $("restpill").hidden=!playerEl.hidden;$("restpill-t").textContent=mmss(left);
  const c=$("pclock");if(c)c.textContent=mmss(left);
}
let wake=null;
async function wakeOn(){try{wake=await navigator.wakeLock.request("screen")}catch(e){}}
function wakeOff(){try{wake&&wake.release()}catch(e){}wake=null}

/* ================= logging form (shared by sheet and player) ================= */
const UI={tab:"today",fg:"all",feq:"all",q:"",logDate:TODAY,anyway:false,hl:true,slow:false,demoView:"isometric",demoPaused:matchMedia("(prefers-reduced-motion: reduce)").matches,editing:null,undo:null,strength:null,metric:"waist",photos:null,restore:null};
let CTX=null; // {ex,date} currently being logged
function stepper(id,val,step,label){
  return `<label class="f">${label}<span class="step"><button type="button" data-act="st" data-for="${id}" data-d="-${step}" aria-label="Less">−</button><input id="${id}" type="number" inputmode="decimal" min="0" step="any" value="${val===null||val===undefined?"":val}"><button type="button" data-act="st" data-for="${id}" data-d="${step}" aria-label="More">+</button></span></label>`;
}
function logForm(e,date){
  const sg=suggest(e,date),today=S.days[date],mine=[];
  if(today)today.entries.forEach(en=>{if(en.ex===e.id)mine.push(...en.sets)});
  const prev=UI.editing?S.days[date].entries[UI.editing.i].sets[UI.editing.k]:mine[mine.length-1];
  const side=e.unilateral?`<label class="f">Side<select id="l-side"><option value="left" ${prev&&prev.side==="left"?"selected":""}>Left</option><option value="right" ${prev&&prev.side==="right"?"selected":""}>Right</option></select></label>`:"";
  if(e.timed)return `<div class="steps">${stepper("l-secs",prev?prev.s:sg.s,5,"Seconds")}${side}<label class="f">Timer<button type="button" class="btn line" style="height:56px" data-act="hold" id="holdbtn">Start timer</button></label></div>`;
  return `<div class="steps">${stepper("l-reps",prev?prev.r:sg.r,1,"Reps")}${side}${e.eq==="bw"?"":stepper("l-kg",prev?(prev.kg||""):(sg.kg||""),"kg",e.id==="goblet"||e.id==="sumo"||e.id==="pullover"||e.id==="triext"||e.id==="swing"||e.id==="twist"?"Dumbbell (kg)":"Each dumbbell (kg)")}</div>`;
}
function setsHtml(e,date){
  const d=S.days[date],out=[];
  if(d)d.entries.forEach((en,i)=>{if(en.ex===e.id)en.sets.forEach((s,k)=>out.push(`<span>${setTxt(s)}<button class="x" data-act="editset" data-i="${i}" data-k="${k}" aria-label="Edit set ${k+1}">Edit</button><button class="x" data-act="delset" data-d="${date}" data-i="${i}" data-k="${k}" aria-label="Remove set">✕</button></span>`))});
  return out.length?`<div class="setlist">${out.join("")}</div>`:"";
}
function readSet(){
  const e=CTX.ex,err=$("l-err");if(err)err.textContent="";
  if(e.timed){const v=Math.round(+$("l-secs").value);if(!(v>0)){if(err)err.textContent="Enter how many seconds you held or worked for.";return null}return {s:v,...($("l-side")?{side:$("l-side").value}:{})}}
  const r=Math.round(+$("l-reps").value);if(!(r>0)){if(err)err.textContent="Enter how many reps you did.";return null}
  const kgEl=$("l-kg"),kg=kgEl?+kgEl.value:0,s={r};if(!Number.isFinite(kg)||kg<0){if(err)err.textContent="Enter a valid weight.";return null}if(kg>0)s.kg=kg;if($("l-side"))s.side=$("l-side").value;return s;
}
function addSet(date,id,s){const d=dayOf(date);if(!d.plan&&P&&P.date===date)d.plan=clone(P.plan);if(!d.plan){const sess=planFor(date);if(sess&&sess.list.some(x=>x.id===id))d.plan=snapshotPlan(sess)}let en=d.entries.find(x=>x.ex===id);if(!en){en={ex:id,sets:[]};d.entries.push(en)}en.sets.push(s);saveDay(date)}
function stepClick(b){
  const inp=$(b.dataset.for),d=b.dataset.d;let v=+inp.value||0;
  if(d.endsWith("kg")){
    const up=!d.startsWith("-"),dbs=S.profile.dbs.slice().sort((a,c)=>a-c);
    if(dbs.length){const nx=up?dbs.find(x=>x>v):dbs.filter(x=>x<v).pop();v=nx!==undefined?nx:(up?v:0)}else v=Math.max(0,v+(up?1:-1));
    inp.value=v||"";
  }else inp.value=Math.max(0,v+ +d);
}
const HOLD={t:null,t0:0,target:0};
function holdToggle(){
  const b=$("holdbtn");
  if(HOLD.t){clearInterval(HOLD.t);HOLD.t=null;$("l-secs").value=Math.max(1,Math.round((Date.now()-HOLD.t0)/1000));b.textContent="Start timer";doLog();return}
  HOLD.target=Math.round(+$("l-secs").value)||30;HOLD.t0=Date.now();
  HOLD.t=setInterval(()=>{const bb=$("holdbtn");if(!bb){clearInterval(HOLD.t);HOLD.t=null;return}
    const left=HOLD.target-Math.floor((Date.now()-HOLD.t0)/1000);
    if(left<=0){clearInterval(HOLD.t);HOLD.t=null;$("l-secs").value=HOLD.target;bb.textContent="Start timer";buzz();doLog()}else bb.textContent=mmss(left)+" · stop"},200);
  b.textContent=mmss(HOLD.target)+" · stop";
}
function doLog(){
  if(!CTX||P&&P.pausedAt)return;const s=readSet();if(!s)return;
  if(UI.editing){S.days[CTX.date].entries[UI.editing.i].sets[UI.editing.k]=s;UI.editing=null;saveDay(CTX.date);if(P)renderPlayer();else openSheet(CTX.ex.id,CTX.date);return}
  addSet(CTX.date,CTX.ex.id,s);if(P)P.logged=(P.logged||0)+1;
  if(P&&!playerEl.hidden)playerAfterLog();else{refreshSheet();if(CTX.date===TODAY)startRest(scheme().rest)}
}

function muscleLegend(e){return `<p class="demo-caption sm"><b>Primary:</b> ${esc((e.muscles||[GROUPS[e.g]]).join(", "))}${e.also.length?` · Helpers: ${esc(e.also.map(g=>GROUPS[g]).join(", "))}`:""}. ${e.custom?"No movement demo for custom exercises.":"3D anatomical illustration; follow the form instructions."}${e.unilateral?" Complete both sides; reps are per side.":""}</p>`}
function strengthHtml(){
  const ids=[...new Set(activityDays().flatMap(d=>S.days[d].entries.map(e=>e.ex)))];
  if(!ids.length)return `<div class="card stack"><h3 class="wide">Strength progress</h3><p class="mute">Log sets to compare your best set for each exercise over time.</p></div>`;
  if(!ids.includes(UI.strength))UI.strength=ids[0];
  const pts=Workout.trend(S.days,UI.strength).filter(x=>x.d<=TODAY),last=pts[pts.length-1];
  return `<div class="card stack"><h3 class="wide">Strength progress</h3><label class="f">Exercise<select id="strength-ex">${ids.map(id=>`<option value="${id}" ${UI.strength===id?"selected":""}>${esc(exName(id))}</option>`).join("")}</select></label>${lineChart(pts,null,last.unit)}<p class="sm mute">Best logged set each day${last.unit==="kg"?"; compare reps as well as load":""}. ${last.unit==="kg"?pts.slice(-4).map(x=>`${short(x.d)}: ${x.v} kg × ${x.r}`).join(" · "):""}</p></div>`;
}
/* ================= exercise sheet ================= */
function figTools(){return `<div class="tools"><button class="pillb" data-act="demo-pause">${UI.demoPaused?"Play demo":"Pause demo"}</button><button class="pillb" data-act="demo-replay">Replay</button><button class="pillb" data-act="demo-view">View: ${UI.demoView}</button><button class="pillb" data-act="tg-hl" aria-pressed="${UI.hl}">Muscles</button><button class="pillb" data-act="tg-slow" aria-pressed="${UI.slow}">Slow motion</button></div>`}
const figAttr=()=>`data-view="${UI.demoView}" data-paused="${UI.demoPaused?1:0}" data-hl="${UI.hl?1:0}"${UI.slow?' data-slow="1"':""}`;
function openSheet(id,date,editing=false){
  clearInterval(HOLD.t);HOLD.t=null;
  if(!editing)UI.editing=null;
  const e=exById(id);if(!e)return;CTX={ex:e,date:date||TODAY};
  const sc=P?playerScheme():S.days[CTX.date]&&S.days[CTX.date].plan?S.days[CTX.date].plan.scheme:scheme(),sg=suggest(e,CTX.date);
  sheet.innerHTML=`<div class="sh g-${e.g}">
    <div class="row between" style="align-items:flex-start;flex-wrap:nowrap"><div><span class="eyebrow">${GROUPS[e.g]}${e.also.length?" · also "+e.also.map(a=>GROUPS[a].toLowerCase()).join(", "):""} · ${eqTxt(e)}</span><h2 class="wide">${esc(e.name)}</h2></div><button class="btn soft sm" data-act="sheet-close">Close</button></div>
    <div class="shgrid"><div class="stage"><canvas data-ex="${e.id}" ${figAttr()}></canvas>${figTools()}${muscleLegend(e)}</div>
      <div class="stack"><ol>${e.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>${e.tip?`<p class="hint">${esc(e.tip)}</p>`:""}</div></div>
    <div class="stack" style="border-top:1px solid var(--rule);padding-top:14px">
      <div class="row between"><h3 class="wide">Log ${CTX.date===TODAY?"today":"for "+nice(CTX.date)}</h3><span class="sm mute">Target ${sc.sets} × ${e.timed?sc.hold+" s":sc.lo+" to "+sc.hi}</span></div>
      <p class="sm"><b>${esc(sg.note)}</b>${sg.lastTxt?`<br><span class="mute">${esc(sg.lastTxt)}</span>`:""}</p>
      ${logForm(e,CTX.date)}
      <button class="btn big" data-act="log">${UI.editing?"Save set changes":"Log set"}</button>${UI.editing?`<button class="btn line" data-act="cancel-edit">Cancel edit</button>`:""}
      <p id="l-err" class="err"></p><div id="l-sets">${setsHtml(e,CTX.date)}</div>
    </div></div>`;
  if(!sheet.open)sheet.showModal();
}
function refreshSheet(){const el=$("l-sets");if(el&&CTX)el.innerHTML=setsHtml(CTX.ex,CTX.date)+(UI.undo?`<button class="btn line sm" data-act="undo">Undo removed set</button>`:"")}
sheet.addEventListener("close",()=>{clearInterval(HOLD.t);HOLD.t=null;sheet.innerHTML="";CTX=null;UI.editing=null;render()});
sheet.addEventListener("click",e=>{if(e.target===sheet)sheet.close()});

/* ================= guided player ================= */
let P=null;const PK="exercisestudio.player";
function savePlayer(){try{P?localStorage.setItem(PK,JSON.stringify(P)):localStorage.removeItem(PK)}catch(e){storageError=true;showSync()}}
function savedPlayer(){try{const s=JSON.parse(localStorage.getItem(PK)||"null");return s&&s.date===TODAY?s:null}catch(e){return null}}
function startPlayer(sess,resume){
  const saved=resume?savedPlayer():null,day=S.days[TODAY];
  const plan=saved&&saved.plan||day&&day.plan||snapshotPlan(sess);
  if(!plan.ids.length)return;
  P=saved&&saved.plan?{...saved}:{date:TODAY,name:plan.name,list:plan.ids,i:0,phase:"work",t0:Date.now(),pausedMs:0,logged:0,before:records(TODAY),plan};
  P.plan=plan;P.list=plan.ids;P.before=P.before||records(TODAY);
  const first=P.list.findIndex(id=>doneSets(TODAY,id)<plan.sets);P.i=first<0?0:first;
  if(first<0)P.phase="sum";else if(P.phase!=="paused")P.phase="work";
  if(day&&!day.plan)day.plan=clone(plan);
  playerEl.hidden=false;document.body.style.overflow="hidden";$("restpill").hidden=true;wakeOn();savePlayer();renderPlayer();
}
function closePlayer(){UI.editing=null;clearInterval(HOLD.t);HOLD.t=null;P=null;savePlayer();stopRest(false);wakeOff();playerEl.hidden=true;playerEl.innerHTML="";document.body.style.overflow="";CTX=null;render()}
function playerAfterLog(){
  const sc=playerScheme(),id=P.list[P.i];
  if(doneSets(P.date,id)>=sc.sets){
    const nx=P.list.findIndex((x,k)=>k>P.i&&doneSets(P.date,x)<sc.sets),any=nx>=0?nx:P.list.findIndex(x=>doneSets(P.date,x)<sc.sets);
    if(any<0){P.phase="sum";savePlayer();renderPlayer();return}
    P.i=any;
  }
  P.phase="rest";savePlayer();renderPlayer();
  startRest(sc.rest,()=>{if(P){P.phase="work";renderPlayer()}});
}
function renderPlayer(){
  if(!P)return;const sc=playerScheme(),n=P.list.length;
  if(P.phase==="paused"){CTX=null;playerEl.innerHTML=`<div class="pcenter"><h1 class="wide">Workout paused</h1><p>Paused time is excluded from your session duration.</p><button class="btn white big" data-act="p-resume">Resume workout</button><button class="btn ghostw" data-act="p-end">End session</button></div>`;return}
  if(P.phase==="sum"){
    const d=S.days[P.date]||{entries:[],min:0},st=dayStats(d),mins=Math.round(Workout.elapsed(P)/60000);
    const complete=P.list.every(id=>doneSets(P.date,id)>=sc.sets);
    const now=records(),prs=Object.keys(now).filter(id=>now[id].d===P.date&&(!P.before[id]||now[id].v>P.before[id].v));
    playerEl.className="player g-full";CTX=null;
    playerEl.innerHTML=`<div class="pcenter"><span class="eyebrow" style="color:#fff">${esc(P.name)} · ${nice(P.date)}</span><h1 class="wide" style="font-size:clamp(40px,11vw,96px)">${complete?"Workout complete":st.sets?"Workout saved as partial":"Workout cancelled"}</h1>
      <div class="stat3"><div><b>${mins}</b><span>minutes</span></div><div><b>${st.sets}</b><span>sets</span></div><div><b>${Math.round(st.vol)}</b><span>kg lifted</span></div></div>
      ${prs.length?`<p style="max-width:46ch"><b>New personal bests:</b> ${prs.map(id=>esc(exName(id))+" ("+now[id].t+")").join(", ")}</p>`:`<p style="max-width:46ch">${st.sets?"Your logged sets are kept. Only completed workouts count toward your weekly goal.":"No sets were logged. This workout will not count toward your goal."}</p>`}
      <button class="btn white big" data-act="p-save" data-min="${mins}">Save and close</button></div>`;
    return;
  }
  const e=exById(P.list[P.i]);
  if(!e){P.list.splice(P.i,1);if(!P.list.length){closePlayer();return}P.i=Math.min(P.i,P.list.length-1);return renderPlayer()}
  const done=doneSets(P.date,e.id);
  const bar=`<div class="bar"><button class="btn ghostw sm" data-act="p-end">End</button><button class="btn ghostw sm" data-act="p-pause">Pause</button><span class="mono" id="pel"></span><span class="eyebrow" style="color:#fff">${P.i+1} of ${n}</span></div>
    <div class="prog">${P.list.map((id,k)=>`<i class="${doneSets(P.date,id)>=sc.sets?"d":k===P.i?"c":""}"></i>`).join("")}</div>`;
  playerEl.className="player g-"+e.g;
  if(P.phase==="rest"){
    CTX=null;
    playerEl.innerHTML=`${bar}<div class="pcenter"><span class="eyebrow" style="color:#fff">Rest</span><div class="bigclock" id="pclock">${mmss(Math.max(0,Math.ceil((R.end-Date.now())/1000)))}</div>
      <p><b>Next:</b> ${esc(e.name)}, set ${Math.min(done+1,sc.sets)} of ${sc.sets}</p>
      <div class="row" style="justify-content:center"><button class="btn ghostw" data-act="rest-add">+15 s</button><button class="btn white" data-act="rest-skip">Skip rest</button></div>
      <canvas class="figpanel" data-ex="${e.id}" data-play="1" style="width:min(300px,60vw);aspect-ratio:6/5"></canvas></div>`;
    return;
  }
  CTX={ex:e,date:P.date};const sg=suggest(e,P.date);
  playerEl.innerHTML=`${bar}<div class="pbody">
    <div class="pfig"><canvas data-ex="${e.id}" ${figAttr()}></canvas>${figTools()}${muscleLegend(e)}</div>
    <div class="pcard"><div><span class="eyebrow">Set ${Math.min(done+1,sc.sets)} of ${sc.sets} · ${GROUPS[e.g]}</span><h1 class="wide">${esc(e.name)}</h1></div>
      <p class="hint"><b>${esc(sg.note)}</b>${sg.lastTxt?`<br><span class="mute sm">${esc(sg.lastTxt)}</span>`:""}</p>
      ${logForm(e,P.date)}
      <button class="btn big" data-act="log">${UI.editing?"Save set changes":"Done · log set"}</button>${UI.editing?`<button class="btn line" data-act="cancel-edit">Cancel edit</button>`:""}<p id="l-err" class="err"></p>
      <div id="l-sets">${setsHtml(e,P.date)}${UI.undo?`<button class="btn line sm" data-act="undo">Undo removed set</button>`:""}</div>
      <details><summary class="sm" style="cursor:pointer;font-weight:700">How to do it</summary><ol class="sm" style="padding-left:20px;margin:8px 0">${e.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>${e.tip?`<p class="sm mute">${esc(e.tip)}</p>`:""}</details>
    </div></div>
    <div class="pnav"><button class="btn ghostw sm" data-act="p-prev" ${P.i===0?"disabled":""}>Previous</button><button class="btn ghostw sm" data-act="p-next">${P.i===n-1?"Finish":"Skip to next"}</button></div>`;
}
setInterval(()=>{const el=$("pel");if(el&&P)el.textContent=mmss(Math.floor(Workout.elapsed(P)/1000))},500);

/* ================= views ================= */
function vToday(){
  const p=S.profile,sc=S.days[TODAY]&&S.days[TODAY].plan?S.days[TODAY].plan.scheme:scheme(),plan=planFor(TODAY),nx=nextPlan(),savedPlan=S.days[TODAY]&&S.days[TODAY].plan,sess=savedPlan?{name:savedPlan.name,g:"full",list:savedPlan.ids.map(id=>({id})),fixed:true}:plan||(UI.anyway&&nx?nx.s:null);
  const w0=wk(TODAY),trained=S.days[TODAY]&&S.days[TODAY].entries.length,saved=savedPlayer();
  const done=weekCounts(1)[0].c;
  let hero;
  if(sess&&sess.list.length){
    const target=savedPlan?savedPlan.sets:sc.sets,all=sess.list.every(x=>doneSets(TODAY,x.id)>=target),mins=Workout.estimatedMinutes(sess.list.reduce((n,x)=>n+(exById(x.id)&&exById(x.id).unilateral?2:1),0),target,sc.rest);
    hero=`<section class="hero g-${sess.g}"><span class="eyebrow">${nice(TODAY)} · session ${Math.min(done+(trained?0:1),p.days.length)} of ${p.days.length} this week</span>
      <h1 class="wide">${sess.name}</h1>
      <p class="meta">${sess.list.length} exercises · ${target} sets of ${sc.lo} to ${sc.hi} · about ${mins} min. ${sc.label} plan.</p>
      <div class="row"><button class="btn white big" data-act="p-start">${all?"Review session":saved||trained?"Continue workout":"Start workout"}</button></div>
      <div class="parade">${sess.list.slice(0,6).map(x=>`<canvas data-ex="${x.id}"></canvas>`).join("")}</div></section>`;
  }else if(sess){
    hero=`<section class="hero rest"><h1 class="wide">No matching workout</h1><p>Adjust equipment, exclusions or session length to build a plan.</p><button class="btn line" data-act="tab" data-tab="setup">Open setup</button></section>`;
  }else{
    hero=`<section class="hero rest"><span class="eyebrow">${nice(TODAY)}</span><h1 class="wide">Rest day</h1>
      <p class="meta">${nx?"Next up: "+nx.s.name+" on "+nice(nx.d)+". ":""}Muscle is built while you recover. A walk and a good night's sleep count.</p>
      <div class="row"><button class="btn line" data-act="anyway">Train anyway</button><button class="btn soft" data-act="tab" data-tab="library">Browse exercises</button></div></section>`;
  }
  const week=WD.map((n,i)=>{
    const d=addD(w0,i),pl=planFor(d),has=S.days[d]&&S.days[d].entries.length,complete=Workout.status(S.days[d])==="completed";
    return `<div class="wd g-${pl?pl.g:"rest"} ${d===TODAY?"today":""} ${complete?"done":pl&&!has&&d<TODAY&&d>=p.created?"missed":""}"><span>${n}</span><b>${pd(d).getDate()}</b><span>${complete?"Done":has?"Partial":pl?TYPE[pl.type].s:"Rest"}</span><em></em></div>`;
  }).join("");
  const show=sess||(nx?nx.s:null);
  const list=show?show.list.map((x,i)=>{
    const e=exById(x.id);if(!e)return "";const n=doneSets(TODAY,x.id),sg=suggest(e,TODAY),target=savedPlan?savedPlan.sets:sc.sets;
    return `<div class="slot g-${e.g}"><span class="ix">${pad(i+1)}</span><button class="tile" data-act="open" data-ex="${e.id}" aria-label="Open ${esc(e.name)}"><canvas data-ex="${e.id}"></canvas></button>
      <span><button class="nm" data-act="open" data-ex="${e.id}">${esc(e.name)}</button><span class="tg">${GROUPS[e.g]} · ${target} × ${e.timed?sg.s+" s":(sg.r||sc.lo)+(sg.kg?" at "+sg.kg+" kg":"")}</span></span>
      <span class="rt"><span class="count ${n>=target?"ok":""}">${n}/${target}</span>${sess&&sess.fixed?"":`<button class="x" data-act="swap" data-key="${x.key}">Swap</button>`}</span></div>`;
  }).join(""):"";
  return `${p.set?"":`<div class="card row between"><div><h3 class="wide">Set your goal first</h3><p class="mute sm">Pick your goal, training days and dumbbells. The weekly plan is built from them.</p></div><button class="btn" data-act="tab" data-tab="setup">Open setup</button></div>`}
    ${hero}${sess&&!sess.list.length?`<div class="banner">No exercises match your settings. Adjust equipment or exclusions in Setup.</div>`:""}<div class="week">${week}</div>
    ${show?`<div class="stack"><div class="row between"><h2 class="wide">${sess?"The session":"Coming up "+nice(nx.d)}</h2><span class="sm mute">${sess?"Rest "+sc.rest+" s between sets":show.name}</span></div>${list}</div>
    <p class="mute sm">Warm up for 3 minutes first: marching in place, arm circles, a few slow squats. The same exercises repeat for four weeks so you can beat last week's numbers, then the plan rotates.</p>`:""}`;
}
function libGrid(){
  const q=UI.q.trim().toLowerCase();
  const list=exAll().filter(e=>(UI.fg==="all"||e.g===UI.fg||e.also.includes(UI.fg))&&(UI.feq==="all"||e.eq===UI.feq||e.eq==="both")&&(!q||e.name.toLowerCase().includes(q)));
  return list.map(e=>`<button class="ex g-${e.g}" data-act="open" data-ex="${e.id}"><canvas data-ex="${e.id}"></canvas><b>${esc(e.name)}</b><small><i>${GROUPS[e.g]}</i>${e.eq==="bw"?"Bodyweight":e.eq==="db"?"Dumbbells":"Either"}</small></button>`).join("")||`<p class="mute">No exercises match. Clear the filters, or add your own in Setup.</p>`;
}
function vLibrary(){
  return `${UI.logDate!==TODAY?`<div class="banner"><span>Logging for ${nice(UI.logDate)}. Pick an exercise.</span><button class="btn sm" data-act="logtoday">Back to today</button></div>`:""}
  <div class="row between"><div><h2 class="wide">Exercise library</h2><p class="mute sm">${exAll().length} moves for home. Tap one for the demo, muscles worked and logging.</p></div><input class="search" id="lib-q" type="search" placeholder="Search exercises" value="${esc(UI.q)}" aria-label="Search exercises"></div>
  <div class="chips">${[["all","All"],...Object.entries(GROUPS)].map(([k,v])=>`<button class="chip g-${k}" data-act="fg" data-v="${k}" aria-pressed="${UI.fg===k}">${k==="all"?"":"<i></i>"}${v}</button>`).join("")}</div>
  <div class="chips">${[["all","Any equipment"],["bw","Bodyweight"],["db","Dumbbells"]].map(([k,v])=>`<button class="chip" data-act="feq" data-v="${k}" aria-pressed="${UI.feq===k}">${v}</button>`).join("")}</div>
  <div class="lib" id="libgrid">${libGrid()}</div>`;
}
function vHistory(){
  const keys=Object.keys(S.days).sort().reverse();
  const add=`<div class="card row"><label class="f" style="width:170px">Date<input id="h-date" type="date" value="${TODAY}" max="${TODAY}"></label><button class="btn line" data-act="logfor" style="align-self:flex-end">Add a workout for this date</button></div>`;
  if(!keys.length)return `<h2 class="wide">History</h2>${add}<div class="card stack"><h3 class="wide">Nothing logged yet</h3><p class="mute">Each training day appears here with its sets, time and weight lifted. You can fix or add past days at any time.</p></div>`;
  return `${keys.some(k=>!S.days[k].plan&&!S.days[k].completed)?`<div class="banner">Older or custom workouts have no saved plan. Confirm completed workouts below; their sets and measurements are preserved.</div>`:""}<div class="row between"><h2 class="wide">History</h2><span class="mute sm">${activityDays().length} active day${activityDays().length===1?"":"s"}</span></div>${add}`+keys.map(k=>{
    const d=S.days[k],st=dayStats(d);
    return `<div class="card day stack"><div class="hd"><h3 class="wide">${nice(k)} · ${statusLabel(d)}</h3><label class="f" style="flex-direction:row;align-items:center;gap:8px">Minutes<input class="minin" id="min-${k}" type="number" min="0" inputmode="numeric" value="${d.min||""}" placeholder="${st.min}" data-min="${k}"></label></div>
    <p class="sm mute">${st.sets} sets${st.vol?" · "+Math.round(st.vol)+" kg lifted":""}${st.kcal!==null?" · about "+st.kcal+" kcal":""}</p>
    <table>${d.entries.map((e,i)=>{const ex=exById(e.ex);return `<tr class="g-${ex?ex.g:"rest"}"><td><i></i></td><td><b>${esc(exName(e.ex))}</b><br><span class="sets">${e.sets.map(setTxt).join(" · ")}</span></td><td>${ex?`<button class="x" data-act="edit" data-d="${k}" data-ex="${e.ex}">Edit</button>`:""}<button class="x" data-act="delentry" data-sure data-d="${k}" data-i="${i}">Remove</button></td></tr>`}).join("")}</table>
    <div class="row"><button class="btn soft sm" data-act="logfor" data-d="${k}">Add exercise</button>${!d.plan&&d.entries.length?`<button class="btn line sm" data-act="manual-complete" data-d="${k}">${d.completed?"Mark partial":"Mark custom workout complete"}</button>`:""}</div></div>`;
  }).join("");
}
function lineChart(pts,target,unit){
  if(pts.length<2)return `<p class="mute sm">Log at least two entries to see the trend line.</p>`;
  const W=320,H=150,L=36,Rr=10,T=14,B=22,vals=pts.map(x=>x.v).concat(target?[target]:[]);
  const lo=Math.floor(Math.min(...vals)-1),hi=Math.ceil(Math.max(...vals)+1);
  const t0=pd(pts[0].d).getTime(),t1=Math.max(pd(pts[pts.length-1].d).getTime(),t0+864e5);
  const X=d=>L+(pd(d).getTime()-t0)/(t1-t0)*(W-L-Rr),Y=v=>T+(hi-v)/(hi-lo)*(H-T-B),last=pts[pts.length-1];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Trend chart">
    <line x1="${L}" y1="${Y(hi)}" x2="${W-Rr}" y2="${Y(hi)}" stroke="var(--rule)"/><line x1="${L}" y1="${Y(lo)}" x2="${W-Rr}" y2="${Y(lo)}" stroke="var(--rule)"/>
    <text x="${L-6}" y="${Y(hi)+4}" text-anchor="end">${hi}</text><text x="${L-6}" y="${Y(lo)+4}" text-anchor="end">${lo}</text>
    ${target?`<line x1="${L}" y1="${Y(target)}" x2="${W-Rr}" y2="${Y(target)}" stroke="var(--good)" stroke-width="2" stroke-dasharray="5 4"/><text x="${W-Rr}" y="${Y(target)-5}" text-anchor="end">target ${target} ${unit}</text>`:""}
    <polyline points="${pts.map(x=>X(x.d).toFixed(1)+","+Y(x.v).toFixed(1)).join(" ")}" fill="none" stroke="var(--go)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(last.d)}" cy="${Y(last.v)}" r="5" fill="var(--go)"/><text x="${Math.min(X(last.d),W-Rr)}" y="${Y(last.v)-10}" text-anchor="end" style="font-weight:700;fill:var(--ink)">${last.v} ${unit}</text>
    <text x="${L}" y="${H-5}">${short(pts[0].d)}</text><text x="${W-Rr}" y="${H-5}" text-anchor="end">${short(last.d)}</text></svg>`;
}
const METRICS={waist:"Waist",chest:"Chest",arms:"Arms",thighs:"Thighs",hips:"Hips"};
function verdict(){
  const p=S.profile,t=wdOf(TODAY),done=weekCounts(1)[0].c,trainedToday=Workout.status(S.days[TODAY])==="completed";
  const w0=wk(TODAY),due=p.days.filter(d=>d<t&&addD(w0,d)>=p.created).length+(p.days.includes(t)&&trainedToday?1:0),gs=groupSets(addD(TODAY,-6));
  const weak=p.focus.filter(f=>gs[f]<10).sort((a,b)=>gs[a]-gs[b])[0];
  let h,s;
  if(!activityDays().length){h="Ready when <span>you are</span>";s="Log your first session and this page starts measuring it against your goal."}
  else if(done>=p.days.length){h="Week <span>complete</span>";s="All "+p.days.length+" planned sessions done this week."}
  else if(done>=due){h="On <span>track</span>";s=done+" of "+p.days.length+" sessions done this week, none missed."}
  else{h="Behind by <span>"+(due-done)+"</span>";s="You have missed "+(due-done)+" planned session"+(due-done>1?"s":"")+" this week. Resume a partial workout or adjust your upcoming schedule."}
  if(weak&&sessionDays().length)s+=" Under target: "+GROUPS[weak].toLowerCase()+", "+Math.round(gs[weak])+" of 10 sets in the last 7 days.";
  return `<div class="stack"><span class="eyebrow">${scheme().label}${p.focus.length?" · focus on "+p.focus.map(f=>GROUPS[f].toLowerCase()).join(", "):""}</span><h2 class="wide verdict">${h}</h2><p style="max-width:60ch">${s}</p></div>`;
}
function calendar(){
  const start=addD(wk(TODAY),-77),cells=[];
  for(let i=0;i<84;i++){const d=addD(start,i),day=S.days[d],n=day?dayStats(day).sets:0;
    const c=n>=20?"t3":n>=10?"t2":n>0?"t1":d>TODAY?"fut":S.profile.days.includes(wdOf(d))&&d>=S.profile.created&&d<TODAY?"miss":"";
    cells.push(`<i class="${c}" title="${nice(d)}${n?": "+n+" sets":""}"></i>`)}
  return `<div class="cal">${cells.join("")}</div>`;
}
function photosHtml(){
  const ph=UI.photos;
  if(ph===null)return `<p class="mute sm">Loading photos from the Pi.</p>`;
  if(ph===false)return `<p class="mute sm">Photos are stored on the Pi, which is not reachable right now.</p>`;
  const cmp=ph.length>=2?`<div class="compare">${[ph[0],ph[ph.length-1]].map(x=>`<div class="photo"><img src="photos/${x.name}" alt="Progress photo ${short(x.date)}"><span>${short(x.date)}</span></div>`).join("")}</div><p class="sm mute">First photo against your latest.</p>`:"";
  return `${cmp}${ph.length?`<div class="photos">${ph.slice().reverse().map(x=>`<div class="photo"><img loading="lazy" src="photos/${x.name}" alt="Progress photo ${short(x.date)}"><span>${short(x.date)}</span><button data-act="delphoto" data-sure data-n="${x.name}">Delete</button></div>`).join("")}</div>`:`<p class="mute sm">No photos yet. Same spot, same light, same pose every two weeks shows changes the scale cannot.</p>`}`;
}
async function loadPhotos(){try{const r=await fetch("api/photos");if(!r.ok)throw 0;UI.photos=await r.json()}catch(e){UI.photos=false}const el=$("ph");if(el)el.innerHTML=photosHtml()}
function vProgress(){
  const p=S.profile,j=journey(),wks=weekCounts(8),gs=groupSets(addD(TODAY,-6)),rec=records(),t=p.days.length;
  const maxW=Math.max(t,...wks.map(x=>x.c),1),totalMin=Object.values(S.days).reduce((n,d)=>n+dayStats(d).min,0);
  const lost=p.startKg&&j.cur?(p.startKg-j.cur):null,ms=p.measures,mPts=ms.filter(m=>m[UI.metric]).map(m=>({d:m.d,v:m[UI.metric]}));
  if(UI.photos===null)loadPhotos();
  return `${verdict()}
  <div class="board">
    <div class="stat"><span class="eyebrow">Weight goal</span>${j.wPct!==null?`<b>${pct(j.wPct)}<small> %</small></b><div class="meter"><i style="width:${pct(j.wPct)}%"></i></div><span class="sm mute">${j.cur} kg now, ${Math.abs(j.cur-p.targetKg).toFixed(1)} kg to go</span>`:`<b>–</b><span class="sm mute">Add start and target weight in Setup</span>`}</div>
    <div class="stat"><span class="eyebrow">12-week block</span><b>${j.hit}<small> / 12</small></b><div class="meter"><i style="width:${pct(j.hit/12)}%"></i></div><span class="sm mute">weeks with all ${t} completed workouts (week ${j.weeksIn} now)</span></div>
    <div class="stat"><span class="eyebrow">Streak</span><b>${streak()}<small> week${streak()===1?"":"s"}</small></b><span class="sm mute">in a row on target</span></div>
    <div class="stat"><span class="eyebrow">Time trained</span><b>${totalMin>=60?(totalMin/60).toFixed(1):totalMin}<small> ${totalMin>=60?"hours":"min"}</small></b><span class="sm mute">${activityDays().length} active day${activityDays().length===1?"":"s"}</span></div>
    <div class="stat"><span class="eyebrow">Weight change</span><b>${lost===null?"–":(lost>0?"−":lost<0?"+":"")+Math.abs(lost).toFixed(1)}<small>${lost===null?"":" kg"}</small></b><span class="sm mute">since you started</span></div>
  </div>
  <div class="card stack"><div class="row between"><h3 class="wide">Last 12 weeks</h3><span class="sm mute">Darker means more sets. Outlined days were planned and missed.</span></div>${calendar()}</div>
  <div class="two">
    <div class="card stack"><h3 class="wide">Sessions per week</h3>
      <div class="weeks">${wks.map(x=>`<div class="w ${x.c>=t?"hit":""}"><span>${x.c||""}</span><i style="height:${x.c/maxW*80}%"></i></div>`).join("")}</div>
      <div class="wl">${wks.map(x=>`<span>${short(x.w)}</span>`).join("")}</div><p class="sm mute">Green weeks met your plan of ${t}.</p></div>
    <div class="card stack"><h3 class="wide">Sets per body area, 7 days</h3>
      <div class="bars">${Object.keys(GROUPS).map(g=>{const f=p.focus.includes(g),tg=f?10:6,v=gs[g];return `<div class="bar g-${g}"><span>${f?"<b>":""}${GROUPS[g]}${f?"</b>":""}</span><div class="meter"><i style="width:${pct(v/tg)}%"></i></div><span>${Math.round(v)}/${tg}</span></div>`}).join("")}</div>
      <p class="sm mute">These are planning guides, not measured muscle growth. Focus areas use 10 sets and others 6; helper muscles count as half a set. Adjust training to your experience and recovery.</p></div>
  </div>
  <div class="two">
    ${strengthHtml()}
    <div class="card stack"><h3 class="wide">Body weight</h3>${lineChart(Workout.weightTrend(p.weigh.filter(x=>x.d<=TODAY)),p.targetKg,"kg")}<p class="sm mute">Rolling 7-day average of recorded weigh-ins; gaps contain no inferred measurements.</p>
      <div class="row" style="align-items:flex-end"><label class="f" style="width:110px">Weight (kg)<input id="w-kg" type="number" step="0.1" min="20" inputmode="decimal"></label><label class="f" style="width:160px">Date<input id="w-date" type="date" value="${TODAY}" max="${TODAY}"></label><button class="btn" data-act="addw">Log</button></div>
      ${p.weigh.length?`<div class="setlist">${p.weigh.slice(-6).map(x=>`<span>${short(x.d)}: ${x.kg} kg<button class="x" data-act="delw" data-d="${x.d}" aria-label="Remove weigh-in">✕</button></span>`).join("")}</div>`:""}</div>
    <div class="card stack"><h3 class="wide">Measurements</h3>
      <div class="chips">${Object.entries(METRICS).map(([k,v])=>`<button class="chip" data-act="metric" data-v="${k}" aria-pressed="${UI.metric===k}">${v}</button>`).join("")}</div>
      ${lineChart(mPts,null,"cm")}
      <div class="fields" style="grid-template-columns:repeat(auto-fit,minmax(84px,1fr))">${Object.entries(METRICS).map(([k,v])=>`<label class="f">${v} cm<input id="m-${k}" type="number" step="0.1" min="0" inputmode="decimal"></label>`).join("")}<label class="f">Date<input id="m-date" type="date" value="${TODAY}" max="${TODAY}"></label></div>
      <div class="row"><button class="btn" data-act="addm">Log measurements</button>${ms.length?`<button class="x" data-act="delm" data-sure>Remove latest (${short(ms[ms.length-1].d)})</button>`:""}</div>
      ${ms.length>1?`<p class="sm mute">Since ${short(ms[0].d)}: ${Object.entries(METRICS).map(([k,v])=>{const a=ms.find(m=>m[k]),b=ms.slice().reverse().find(m=>m[k]);return a&&b&&a!==b?v.toLowerCase()+" "+(b[k]-a[k]>0?"+":"")+(b[k]-a[k]).toFixed(1)+" cm":null}).filter(Boolean).join(", ")||"no change yet"}.</p>`:`<p class="sm mute">Measure in the morning, tape level, same spot each time. Every two weeks is enough.</p>`}</div>
  </div>
  <div class="two">
    <div class="card stack"><div class="row between"><h3 class="wide">Progress photos</h3><label class="btn sm line" style="cursor:pointer">Add photo<input id="ph-file" type="file" accept="image/*" hidden></label></div><p id="ph-msg" class="err"></p><div id="ph" class="stack">${photosHtml()}</div></div>
    <div class="card stack"><h3 class="wide">Personal bests</h3>${Object.keys(rec).length?`<table class="tbl">${Object.keys(rec).map(id=>`<tr><td>${esc(exName(id))}<br><span class="sm mute">${short(rec[id].d)}</span></td><td>${rec[id].t}</td></tr>`).join("")}</table>`:`<p class="mute sm">Your best set for each exercise appears here. Beating these is the clearest sign you are getting stronger.</p>`}</div>
  </div>`;
}
function vSetup(){
  const p=S.profile;
  return `<div><h2 class="wide">Setup</h2><p class="mute sm">Everything here saves as you change it and reshapes the plan.</p></div>
  <div class="card stack"><h3 class="wide">Goal</h3>
    <div class="chips">${Object.entries(SCHEMES).map(([k,v])=>`<button class="chip" data-act="goal" data-v="${k}" aria-pressed="${p.goal===k}">${v.label}</button>`).join("")}</div>
    <p class="sm mute">${({lose:"Strength and cardio practice. Weight change also depends on eating habits, everyday activity and recovery.",trim:"Track strength, waist and weight together. Target muscles for training; these set counts do not measure fat loss.",muscle:"Heavier sets of 8 to 12 with longer rests, and extra work for your focus areas."})[p.goal]}</p>
    <div class="fields"><label class="f">Starting weight (kg)<input id="g-start" data-p="startKg" type="number" step="0.1" min="20" inputmode="decimal" value="${p.startKg||""}"></label><label class="f">Target weight (kg)<input id="g-target" data-p="targetKg" type="number" step="0.1" min="20" inputmode="decimal" value="${p.targetKg||""}"></label></div>
    <div><span class="eyebrow">Muscle areas to focus on</span><div class="chips" style="margin-top:8px">${Object.entries(GROUPS).map(([k,v])=>`<button class="chip g-${k}" data-act="focus" data-v="${k}" aria-pressed="${p.focus.includes(k)}"><i></i>${v}</button>`).join("")}</div></div></div>
  <div class="card stack"><h3 class="wide">Make the plan fit you</h3><div class="fields">
    <label class="f">Experience<select data-pref="experience"><option value="beginner" ${p.experience==="beginner"?"selected":""}>Beginner · 2 sets</option><option value="experienced" ${p.experience==="experienced"?"selected":""}>Experienced</option></select></label>
    <label class="f">Session length<select data-pref="minutes">${[15,20,30,45,60].map(v=>`<option value="${v}" ${p.minutes===v?"selected":""}>${v} minutes</option>`).join("")}</select></label></div>
    <label class="check"><input type="checkbox" data-pref="hasDumbbells" ${p.hasDumbbells?"checked":""}> I have dumbbells</label>
    <label class="check"><input type="checkbox" data-pref="chair" ${p.chair?"checked":""}> I have a sturdy chair or bench</label>
    <label class="check"><input type="checkbox" data-pref="lowImpact" ${p.lowImpact?"checked":""}> Prefer low-impact exercises</label>
    <p class="sm mute">List your dumbbell weights below so suggestions only use weights you own. Exclusions apply to your next workout; an in-progress plan stays fixed.</p>
    <details><summary>Exercises to leave out</summary><div class="exclude-list">${EX.map(e=>`<label class="check"><input type="checkbox" data-exclude="${e.id}" ${p.excluded.includes(e.id)?"checked":""}> ${esc(e.name)}</label>`).join("")}</div></details></div>
  <div class="card stack"><h3 class="wide">Training days</h3>
    <div class="chips">${WD.map((n,i)=>`<button class="chip" data-act="tday" data-v="${i}" aria-pressed="${p.days.includes(i)}">${n}</button>`).join("")}</div>
    <p class="sm mute">${p.days.length} day${p.days.length>1?"s":""} a week: ${SEQ[p.days.length].map((t,i)=>WD[p.days[i]]+" "+TYPE[t].s.toLowerCase()).join(", ")}.</p></div>
  <div class="card stack"><h3 class="wide">Your dumbbells</h3>
    ${p.dbs.length?`<div class="setlist">${p.dbs.slice().sort((a,b)=>a-b).map(x=>`<span>${x} kg<button class="x" data-act="deldb" data-v="${x}" aria-label="Remove ${x} kg">✕</button></span>`).join("")}</div>`:`<p class="sm mute">List the weights you own (per dumbbell) so suggestions only use those.</p>`}
    <div class="row" style="align-items:flex-end"><label class="f" style="width:130px">Weight (kg)<input id="db-kg" type="number" step="0.5" min="0.5" inputmode="decimal"></label><button class="btn" data-act="adddb">Add</button></div></div>
  <div class="card stack"><h3 class="wide">Your own exercises</h3>
    ${p.custom.length?`<table class="tbl">${p.custom.map(c=>`<tr><td>${esc(c.name)}<br><span class="sm mute">${GROUPS[c.g]} · ${c.timed?"timed":"reps"}</span></td><td><button class="x" data-act="delcustom" data-sure data-id="${c.id}">Remove</button></td></tr>`).join("")}</table>`:""}
    <div class="fields"><label class="f">Name<input id="c-name" type="text" maxlength="40"></label><label class="f">Body area<select id="c-g">${Object.entries(GROUPS).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select></label>
      <label class="f">Equipment<select id="c-eq"><option value="bw">Bodyweight</option><option value="db">Dumbbells</option></select></label><label class="f">Counted in<select id="c-timed"><option value="0">Reps</option><option value="1">Seconds</option></select></label></div>
    <label class="f">Form notes (optional)<input id="c-notes" type="text" maxlength="200"></label>
    <div class="row"><button class="btn" data-act="addcustom">Add exercise</button><span id="c-msg" class="err"></span></div></div>
  <div class="card stack"><h3 class="wide">Your data</h3>
    <p class="sm mute">Everything is stored on the Pi and backed up there once a day (the last 30 days are kept). The log backup excludes photos; the log + photos archive includes them.</p>
    <div class="row"><button class="btn line" data-act="csv">Export sets as CSV</button><a class="btn line" href="api/backup" download>Download log backup</a><a class="btn line" href="api/archive" download>Download log + photos</a><label class="btn soft" style="cursor:pointer">Restore from backup<input id="rs-file" type="file" accept="application/json,.json" hidden></label></div>
    ${UI.restore?`<div class="banner"><span>Replace everything on the Pi with this backup (${Object.keys(UI.restore.days||{}).length} days)?</span><span class="row"><button class="btn sm" data-act="restore">Replace</button><button class="btn sm soft" data-act="restore-no">Cancel</button></span></div>`:""}
    <p id="rs-msg" class="err"></p>
    <p class="sm mute"><b>Add to your phone:</b> open this page in Safari or Chrome, tap Share (or the menu) and choose Add to Home Screen. It then opens full screen like an app.</p></div>`;
}
function render(){
  main.innerHTML=`<div id="sync-notice"></div>${UI.undo?`<div class="banner">Set removed. <button class="btn line sm" data-act="undo">Undo</button></div>`:""}`+({today:vToday,library:vLibrary,history:vHistory,progress:vProgress,setup:vSetup})[UI.tab]();
  document.querySelectorAll("#tabs button").forEach(b=>{if(b.dataset.tab===UI.tab)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  showSync();
}
function go(tab){UI.editing=null;UI.tab=tab;try{history.replaceState(null,"","#"+tab)}catch(e){}render();scrollTo(0,0)}

/* ================= events ================= */
function downloadText(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
document.addEventListener("click",async ev=>{
  const b=ev.target.closest("[data-act]");if(!b)return;
  const a=b.dataset.act,p=S.profile;
  if(b.dataset.sure!==undefined&&!b.dataset.armed){b.dataset.armed="1";b.dataset.txt=b.textContent;b.textContent="Sure?";setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent=b.dataset.txt}},3000);return}
  switch(a){
    case "conflict-download":{const key=b.dataset.key;downloadText("exercise-conflict-"+key+".json",JSON.stringify({device:key==="profile"?S.profile:S.days[key],pi:conflicts[key].current},null,2),"application/json");break}
    case "conflict-pi":case "conflict-mine":{const key=b.dataset.key,c=conflicts[key];if(!c)break;
      if(key==="profile"){revisions.profile=c.revision;if(a==="conflict-pi"){S.profile=fixProfile(c.current);D.profile=false}}
      else{revisions.days[key]=c.revision;if(a==="conflict-pi"){if(c.current)S.days[key]=c.current;else delete S.days[key];delete D.days[key]}}
      delete conflicts[key];saveLocal();render();showSync();flush();break}
    case "demo-view":{const views=["isometric","front","side"];UI.demoView=views[(views.indexOf(UI.demoView)+1)%views.length];b.closest(".stage,.pfig").querySelector("canvas").dataset.view=UI.demoView;b.textContent="View: "+UI.demoView;break}
    case "demo-pause":{UI.demoPaused=!UI.demoPaused;const cv=b.closest(".stage,.pfig").querySelector("canvas");cv.dataset.paused=UI.demoPaused?"1":"0";b.textContent=UI.demoPaused?"Play demo":"Pause demo";break}
    case "demo-replay":{const cv=b.closest(".stage,.pfig").querySelector("canvas");cv.dataset.restart="1";break}
    case "editset":UI.editing={i:+b.dataset.i,k:+b.dataset.k};if(P)renderPlayer();else openSheet(CTX.ex.id,CTX.date,true);break;
    case "cancel-edit":clearInterval(HOLD.t);HOLD.t=null;UI.editing=null;if(P)renderPlayer();else openSheet(CTX.ex.id,CTX.date);break;
    case "undo":{const u=UI.undo;if(!u)break;const d=dayOf(u.date);if(!d.plan&&u.plan)d.plan=u.plan;if(!d.min)d.min=u.min||0;let en=d.entries.find(e=>e.ex===u.ex);if(!en){en={ex:u.ex,sets:[]};d.entries.push(en)}en.sets.splice(Math.min(u.k,en.sets.length),0,u.set);UI.undo=null;saveDay(u.date);if(P)renderPlayer();else if(sheet.open)refreshSheet();else render();break}
    case "manual-complete":{const d=S.days[b.dataset.d];d.completed=!d.completed;saveDay(b.dataset.d);render();break}
    case "p-pause":{P.pausedAt=Date.now();P.returnPhase=P.phase;P.restLeft=R.end?Math.max(0,Math.ceil((R.end-Date.now())/1000)):0;stopRest(false);clearInterval(HOLD.t);HOLD.t=null;P.phase="paused";wakeOff();savePlayer();renderPlayer();break}
    case "p-resume":{P.pausedMs=(P.pausedMs||0)+Date.now()-P.pausedAt;P.pausedAt=0;P.phase=P.returnPhase||"work";wakeOn();if(P.phase==="rest"&&P.restLeft)startRest(P.restLeft,()=>{P.phase="work";renderPlayer()});else P.phase="work";savePlayer();renderPlayer();break}

    case "tab":go(b.dataset.tab);break;
    case "open":openSheet(b.dataset.ex,UI.tab==="library"?UI.logDate:TODAY);break;
    case "edit":openSheet(b.dataset.ex,b.dataset.d);break;
    case "sheet-close":sheet.close();break;
    case "st":stepClick(b);break;
    case "hold":holdToggle();break;
    case "log":doLog();break;
    case "delset":{const d=S.days[b.dataset.d],en=d.entries[+b.dataset.i];UI.undo={date:b.dataset.d,ex:en.ex,k:+b.dataset.k,set:clone(en.sets[+b.dataset.k]),plan:clone(d.plan||null),min:d.min};UI.editing=null;en.sets.splice(+b.dataset.k,1);if(!en.sets.length)d.entries.splice(+b.dataset.i,1);saveDay(b.dataset.d);
      if(P&&!playerEl.hidden)renderPlayer();else refreshSheet();break}
    case "delentry":S.days[b.dataset.d].entries.splice(+b.dataset.i,1);saveDay(b.dataset.d);render();break;
    case "tg-hl":case "tg-slow":{const k=a==="tg-hl"?"hl":"slow";UI[k]=!UI[k];b.setAttribute("aria-pressed",UI[k]);
      const cv=b.closest(".stage,.pfig").querySelector("canvas");if(k==="hl")cv.dataset.hl=UI.hl?"1":"0";else if(UI.slow)cv.dataset.slow="1";else delete cv.dataset.slow;break}
    case "rest-add":R.end+=15000;tickRest();break;
    case "rest-skip":stopRest(true);break;
    case "anyway":UI.anyway=true;render();break;
    case "swap":p.swaps[b.dataset.key]=(p.swaps[b.dataset.key]||0)+1;saveProfile();render();break;
    case "p-start":{const s=planFor(TODAY)||(nextPlan()||{}).s;if(s)startPlayer(s,true);break}
    case "p-end":if(P.pausedAt){P.pausedMs=(P.pausedMs||0)+Date.now()-P.pausedAt;P.pausedAt=0}P.phase="sum";stopRest(false);renderPlayer();break;
    case "p-prev":UI.editing=null;if(P.i>0){P.i--;P.phase="work";stopRest(false);savePlayer();renderPlayer()}break;
    case "p-next":UI.editing=null;stopRest(false);if(P.i>=P.list.length-1)P.phase="sum";else{P.i++;P.phase="work"}savePlayer();renderPlayer();break;
    case "p-save":{const m=+b.dataset.min,d=S.days[P.date];if(d&&d.entries.length&&P.logged){d.min=(d.min||0)+m;d.plan=clone(P.plan);saveDay(P.date)}closePlayer();break}
    case "fg":UI.fg=b.dataset.v;render();break;
    case "feq":UI.feq=b.dataset.v;render();break;
    case "logfor":UI.logDate=b.dataset.d||$("h-date").value||TODAY;go("library");break;
    case "logtoday":UI.logDate=TODAY;render();break;
    case "metric":UI.metric=b.dataset.v;render();break;
    case "goal":p.goal=b.dataset.v;p.set=true;saveProfile();render();break;
    case "focus":{const v=b.dataset.v;p.focus=p.focus.includes(v)?p.focus.filter(x=>x!==v):p.focus.concat(v);p.set=true;saveProfile();render();break}
    case "tday":{const v=+b.dataset.v;let ds=p.days.includes(v)?p.days.filter(x=>x!==v):p.days.concat(v);if(!ds.length)break;p.days=ds.sort((x,y)=>x-y);p.set=true;saveProfile();render();break}
    case "adddb":{const v=+$("db-kg").value;if(v>0&&!p.dbs.includes(v)){p.dbs.push(v);saveProfile();render()}break}
    case "deldb":p.dbs=p.dbs.filter(x=>x!==+b.dataset.v);saveProfile();render();break;
    case "addcustom":{const name=$("c-name").value.trim();if(!name){$("c-msg").textContent="Give the exercise a name.";break}
      p.custom.push({id:"c_"+Date.now().toString(36),name,g:$("c-g").value,eq:$("c-eq").value,timed:$("c-timed").value==="1",notes:$("c-notes").value.trim()});saveProfile();render();break}
    case "delcustom":p.custom=p.custom.filter(c=>c.id!==b.dataset.id);saveProfile();render();break;
    case "addw":{const kg=+$("w-kg").value,d=$("w-date").value||TODAY;if(!(kg>0))break;
      p.weigh=p.weigh.filter(x=>x.d!==d).concat({d,kg}).sort((x,y)=>x.d<y.d?-1:1);if(!p.startKg)p.startKg=p.weigh[0].kg;saveProfile();render();break}
    case "delw":p.weigh=p.weigh.filter(x=>x.d!==b.dataset.d);saveProfile();render();break;
    case "addm":{const d=$("m-date").value||TODAY,m={d};let any=false;Object.keys(METRICS).forEach(k=>{const v=+$("m-"+k).value;if(v>0){m[k]=v;any=true}});if(!any)break;
      const old=p.measures.find(x=>x.d===d);p.measures=p.measures.filter(x=>x.d!==d).concat(Object.assign({},old,m)).sort((x,y)=>x.d<y.d?-1:1);saveProfile();render();break}
    case "delm":p.measures.pop();saveProfile();render();break;
    case "delphoto":try{await fetch("api/photos/"+b.dataset.n,{method:"DELETE"})}catch(e){}loadPhotos();break;
    case "csv":{const rows=[["date","exercise","body_area","set","reps","kg","seconds"]];
      Object.keys(S.days).sort().forEach(k=>S.days[k].entries.forEach(e=>{const ex=exById(e.ex);e.sets.forEach((s,i)=>rows.push([k,exName(e.ex),ex?GROUPS[ex.g]:"",i+1,s.r||"",s.kg||"",s.s||""]))}));
      downloadText("exercise-studio-"+TODAY+".csv",rows.map(r=>r.map(c=>/[",\n]/.test(String(c))?'"'+String(c).replace(/"/g,'""')+'"':c).join(",")).join("\n"),"text/csv");break}
    case "restore":try{const r=await fetch("api/restore",{method:"POST",headers:J,body:JSON.stringify({...UI.restore,baseRevisions:revisions})});if(!r.ok)throw 0;UI.restore=null;D={profile:false,days:{}};conflicts={};revisions={profile:0,days:{}};await connect();render()}catch(e){$("rs-msg").textContent="Could not restore. The Pi may be unreachable or changed on another device. Refresh and review before retrying."}break;
    case "restore-no":UI.restore=null;render();break;
  }
});
document.addEventListener("change",async ev=>{
  const t=ev.target,p=S.profile;
  if(t.dataset.pref){p[t.dataset.pref]=t.type==="checkbox"?t.checked:t.dataset.pref==="minutes"?+t.value:t.value;p.set=true;saveProfile();render();return}
  if(t.dataset.exclude){p.excluded=t.checked?[...new Set([...p.excluded,t.dataset.exclude])]:p.excluded.filter(id=>id!==t.dataset.exclude);saveProfile();return}
  if(t.id==="strength-ex"){UI.strength=t.value;render();return}
  if(t.dataset.min){S.days[t.dataset.min].min=Math.max(0,Math.round(+t.value||0));saveDay(t.dataset.min);render();return}
  if(t.dataset.p){const v=+t.value;p[t.dataset.p]=v>0?v:null;
    if(t.dataset.p==="startKg"&&p.startKg&&!p.weigh.length)p.weigh.push({d:TODAY,kg:p.startKg});saveProfile();return}
  if(t.id==="ph-file"&&t.files[0]){
    const msg=$("ph-msg");msg.textContent="";
    try{
      const img=await createImageBitmap(t.files[0]),k=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement("canvas");
      c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.85));
      const r=await fetch("api/photos?date="+TODAY,{method:"POST",headers:{"Content-Type":"image/jpeg"},body:blob});if(!r.ok)throw 0;
      loadPhotos();
    }catch(e){msg.textContent="Could not save the photo. The Pi must be reachable to add photos."}
    return;
  }
  if(t.id==="rs-file"&&t.files[0]){
    try{const o=JSON.parse(await t.files[0].text());if(!o||typeof o.days!=="object")throw 0;UI.restore={profile:o.profile||null,days:o.days};render()}
    catch(e){$("rs-msg").textContent="That file is not an Exercise Studio backup."}
  }
});
document.addEventListener("input",ev=>{if(ev.target.id==="lib-q"){UI.q=ev.target.value;$("libgrid").innerHTML=libGrid()}});

/* ================= boot ================= */
const h0=(location.hash||"").slice(1);if(["today","library","history","progress","setup"].includes(h0))UI.tab=h0;
loadLocal();render();showSync();requestAnimationFrame(figLoop);connect();
if("serviceWorker" in navigator&&window.isSecureContext)navigator.serviceWorker.register("sw.js").catch(()=>{});

// A home-screen app may stay open across midnight. Never silently log yesterday as today.
addEventListener("visibilitychange",()=>{if(document.visibilityState!=="visible")return;const now=ymd(new Date());if(now!==TODAY&&!P){TODAY=now;UI.logDate=now;render()}if(P&&!P.pausedAt)wakeOn()});

// Exercise the actual client source with a tiny DOM/network adapter, without a
// second render implementation or access to real browser/user data.
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function client(fetch){
  const elements=new Map(),handlers={},storage=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',lastElementChild:{},addEventListener(){},dataset:{}});return elements.get(id)};
  const context=vm.createContext({Date,Math,JSON,Set,Map,console,fetch,setTimeout,clearTimeout,setInterval(){},clearInterval(){},matchMedia:()=>({matches:false}),addEventListener(){},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{getElementById:element,addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:()=>[],activeElement:{matches:()=>false},body:{style:{}}},navigator:{},scrollTo(){},history:{replaceState(){}}});
  vm.runInContext('window=this',context);
  for(const file of ['workout.js','data.js'])vm.runInContext(fs.readFileSync('public/'+file,'utf8'),context);
  vm.runInContext(fs.readFileSync('public/app.js','utf8').split('/* ================= boot')[0],context);
  return {run:code=>vm.runInContext(code,context),elements,handlers};
}
test('generated plans obey selected equipment and freeze targets during logging',()=>{
  const c=client(async()=>({ok:true,json:async()=>({revision:1})}));
  c.run('S.profile=fixProfile({dbs:[],chair:false,experience:"beginner",minutes:15,lowImpact:true});');
  assert.equal(c.run('buildSession(0).list.every(x=>Workout.eligible(exById(x.id),S.profile))'),true);
  assert.equal(c.run('buildSession(0).list.some(x=>exById(x.id).eq==="db")'),false);
  c.run('const sess=buildSession(0);const frozen=snapshotPlan(sess);S.days[TODAY]={entries:[{ex:sess.list[0].id,sets:[{r:8}]}],plan:frozen};S.profile.experience="experienced";');
  assert.equal(c.run('S.days[TODAY].plan.sets'),2);assert.equal(c.run('scheme().sets'),4);
});
test('a conflict remains pending and is not retried or overwritten automatically',async()=>{
  let requests=0;
  const c=client(async()=>{requests++;return {status:409,json:async()=>({revision:4,current:{entries:[{ex:'curl',sets:[{r:9}]}]}})}});
  c.run('S.days[TODAY]={entries:[{ex:"curl",sets:[{r:8}]}]};D.days[TODAY]=1;');
  await c.run('flush()');await c.run('flush()');
  assert.equal(requests,1);assert.equal(c.run('pending()'),1);assert.equal(c.run('S.days[TODAY].entries[0].sets[0].r'),8);assert.equal(c.run('conflicts[TODAY].revision'),4);
});
test('a delayed state read cannot discard an edit made while reading',async()=>{
  let resolve;
  const c=client(async()=>({ok:true,json:()=>new Promise(r=>resolve=r)}));
  const reading=c.run('connect()');
  await new Promise(r=>setImmediate(r));
  c.run('S.profile.goal="lose";editGeneration++;');resolve({profile:{goal:'muscle'},days:{},revisions:{profile:1,days:{}}});await reading;
  assert.equal(c.run('S.profile.goal'),'lose');
});
test('undo reinserts the removed set without discarding intervening new sets',async()=>{
  const c=client(async()=>({ok:true,json:async()=>({revision:1})}));
  c.run('S.days[TODAY]={entries:[{ex:"curl",sets:[{r:12}]}]};UI.undo={date:TODAY,ex:"curl",k:0,set:{r:8}};');
  await c.handlers.click({target:{closest:()=>({dataset:{act:'undo'}})}});
  assert.equal(c.run('JSON.stringify(S.days[TODAY].entries[0].sets.map(s=>s.r))'),'[8,12]');
});

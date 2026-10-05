const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function worker(fetch){
  const events={},stored=new Map(),deleted=[];
  const context={URL,Response,Error,Promise,fetch,self:{registration:{scope:'https://pi.test/exercise/'},addEventListener:(name,fn)=>events[name]=fn},caches:{open:async()=>({put:async(k,v)=>stored.set(k,v),match:async k=>stored.get(k)}),keys:async()=>['other-app-cache','exercise-studio-v3','exercise-studio-v4','exercise-studio-v5'],delete:async k=>deleted.push(k)}};
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);return {events,stored,deleted};
}
test('a 401 or HTML fallback cannot replace the offline shell',async()=>{
  for(const broken of ['401','html']){
    const w=worker(async url=>new Response('login',{status:broken==='401'?401:200,headers:{'Content-Type':'text/html'}}));let task;
    w.events.install({waitUntil:p=>task=p});await assert.rejects(task);assert.equal(w.stored.size,0);
  }
});
test('activation only removes this app cache and API responses are never cached',async()=>{
  const w=worker(()=>{throw Error('Offline')});let task;
  w.events.activate({waitUntil:p=>task=p});await task;assert.deepEqual(w.deleted,['exercise-studio-v3','exercise-studio-v4']);
  let intercepted=false;w.events.fetch({request:{method:'GET',url:'https://pi.test/exercise/api/state'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  w.events.fetch({request:{method:'GET',url:'https://pi.test/exercise/not-a-script.js'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});

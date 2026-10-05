const test=require('node:test');const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const net=require('node:net');
let child,dir,origin;
test.before(async()=>{
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'exercise-test-'));
  const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));origin='http://127.0.0.1:'+port+'/';
  child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Server startup timed out')),5000);child.stdout.once('data',()=>{clearTimeout(timeout);resolve()});child.once('exit',()=>reject(Error('Server exited')))});
});
test.after(()=>{child&&child.kill();fs.rmSync(dir,{recursive:true,force:true})});
async function request(route,method='GET',body,revision){return fetch(new URL(route,origin),{method,headers:{'Content-Type':'application/json',...(revision===undefined?{}:{'If-Match':String(revision)})},...(body?{body:JSON.stringify(body)}:{})})}
test('stale concurrent saves and deletes cannot overwrite data',async()=>{
  const day={entries:[{ex:'curl',sets:[{r:8,kg:5}]}],min:2};
  const first=await request('api/days/2026-10-05','PUT',day,0);assert.equal(first.status,200);assert.equal((await first.json()).revision,1);
  const stale=await request('api/days/2026-10-05','PUT',{entries:[]},0);assert.equal(stale.status,409);assert.deepEqual((await stale.json()).current,day);
  assert.equal((await request('api/days/2026-10-05','DELETE',null,0)).status,409);
  assert.equal((await request('api/days/2026-10-05','PUT',day)).status,428);
  const parallel=await Promise.all([request('api/days/2026-10-05','PUT',day,1),request('api/days/2026-10-05','PUT',day,1)]);assert.deepEqual(parallel.map(r=>r.status).sort(),[200,409]);
  const deleted=await request('api/days/2026-10-05','DELETE',null,2);assert.equal(deleted.status,200);assert.equal((await deleted.json()).revision,3);
  assert.equal((await request('api/days/2026-10-05','PUT',day,2)).status,409);
});
test('profile conflicts preserve the Pi profile',async()=>{
  const first=await request('api/profile','PUT',{goal:'muscle'},0);assert.equal(first.status,200);
  const stale=await request('api/profile','PUT',{goal:'lose'},0);assert.equal(stale.status,409);assert.equal((await stale.json()).current.goal,'muscle');
});
test('archive includes photos and current state; assets have correct bytes and MIME',async()=>{
  const jpeg=Buffer.from([255,216,255,217]);
  const upload=await fetch(new URL('api/photos?date=2026-10-05',origin),{method:'POST',headers:{'Content-Type':'image/jpeg'},body:jpeg});assert.equal(upload.status,200);const photo=await upload.json();
  const response=await request('api/archive');assert.equal(response.status,200);const file=path.join(dir,'download.tar.gz');fs.writeFileSync(file,Buffer.from(await response.arrayBuffer()));
  const names=execFileSync('tar',['-tzf',file],{encoding:'utf8'});assert.match(names,/state.json/);assert.ok(names.includes('photos/'+photo.name));
  const packed=JSON.parse(execFileSync('tar',['-xOzf',file,'state.json'],{encoding:'utf8'}));assert.equal(packed.profile.goal,'muscle');
  const icon=await request('icon-512.png');assert.match(icon.headers.get('content-type'),/image\/png/);assert.deepEqual(Buffer.from(await icon.arrayBuffer()),fs.readFileSync(path.join(__dirname,'../public/icon-512.png')));
  assert.equal((await (await request('api/health')).json()).version,'1.1.0');
  assert.ok(fs.readdirSync(path.join(dir,'backups')).some(f=>f.endsWith('.tar.gz')));
});
test('invalid nested logs are rejected and restore cannot bypass revision checks',async()=>{
  assert.equal((await request('api/days/2026-10-06','PUT',{entries:[{ex:'curl',sets:[{r:-1}]}]},0)).status,400);
  const base=await (await request('api/state')).json();
  assert.equal((await request('api/restore','POST',{profile:base.profile,days:base.days})).status,409);
  assert.equal((await request('api/profile','PUT',{goal:'lose'},base.revisions.profile)).status,200);
  assert.equal((await request('api/restore','POST',{profile:base.profile,days:base.days,baseRevisions:base.revisions})).status,409);
  const current=await (await request('api/state')).json();
  assert.equal((await request('api/restore','POST',{profile:base.profile,days:base.days,baseRevisions:current.revisions})).status,200);
  const restored=await (await request('api/state')).json();assert.equal(restored.profile.goal,'muscle');assert.ok(restored.revisions.profile>current.revisions.profile);
});

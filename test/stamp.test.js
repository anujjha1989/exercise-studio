const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {stamp,serviceWorker,MARK}=require('../release-stamp');
test('offline cache name changes whenever any app file changes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stamp-'));
  fs.writeFileSync(path.join(dir,'sw.js'),'const CACHE = "'+MARK+'";');fs.writeFileSync(path.join(dir,'app.js'),'one');
  const first=stamp(dir),served=serviceWorker(dir);
  assert.ok(served.includes('exercise-studio-'+first));assert.ok(!served.includes(MARK));
  assert.equal(stamp(dir),first);
  fs.writeFileSync(path.join(dir,'app.js'),'two');assert.notEqual(stamp(dir),first);
  fs.rmSync(dir,{recursive:true});
});
test('the real service worker carries the marker the server replaces',()=>{
  assert.match(serviceWorker(path.join(__dirname,'../public')),/const CACHE = "exercise-studio-[0-9a-f]{12}";/);
});

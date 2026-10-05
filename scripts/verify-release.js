// Verify actual bytes and MIME types. Pass an authenticated origin if required.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const origin=process.argv[2]||'http://127.0.0.1:4320/';
const types={'.html':'text/html','.js':'javascript','.mjs':'javascript','.txt':'text/plain','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.ttf':'font/ttf'};
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
(async()=>{
  const health=await fetch(new URL('api/health',origin),{signal:AbortSignal.timeout(5000)});
  if(!health.ok||(await health.json()).version!==require('../package.json').version)throw Error('Wrong health/version response');
  function files(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name]);}
  for(const name of files(path.join(__dirname,'../public'))){
    const expected=types[path.extname(name)];if(!expected)continue;
    const response=await fetch(new URL(name,origin),{redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok||!(response.headers.get('content-type')||'').includes(expected))throw Error('Wrong status/MIME: '+name);
    if(hash(Buffer.from(await response.arrayBuffer()))!==hash(fs.readFileSync(path.join(__dirname,'../public',name))))throw Error('Wrong bytes: '+name);
  }
  console.log('Version and all public asset bytes/MIME verified at '+origin);
})().catch(error=>{console.error(error.message);process.exitCode=1});

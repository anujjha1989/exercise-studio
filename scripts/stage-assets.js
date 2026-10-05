// Reproduce the committed browser dependency from the exact lockfile version.
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..'),dest=path.join(root,'public/vendor');fs.mkdirSync(dest,{recursive:true});
for(const file of ['three.module.js','three.core.js'])fs.copyFileSync(path.join(root,'node_modules/three/build',file),path.join(dest,file));
fs.copyFileSync(path.join(root,'node_modules/three/LICENSE'),path.join(dest,'three-LICENSE.txt'));
console.log('Staged Three.js browser assets from the locked dependency.');

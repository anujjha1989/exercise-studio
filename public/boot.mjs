import * as THREE from './vendor/three.module.js';
window.THREE=THREE;
// One ordered boot path for the existing source-owned app and exercise data.
async function script(name){
  return new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=name;tag.onload=resolve;tag.onerror=()=>reject(Error('Could not load '+name));document.body.appendChild(tag)});
}
try {
  for(const name of ['workout.js','figure-math.js','data.js','figure.js','app.js'])await script(name);
} catch(error) {
  document.getElementById('main').textContent='The app could not load. Reconnect and reload to finish the update.';
  console.error(error);
}

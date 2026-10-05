'use strict';
/* One orthographic 3D renderer, shared across all preview canvases. Geometry is
   source-owned; no copied model or remote runtime assets. Library previews are
   still images; only the open demo is animated, capped at 30 fps. */
const DEMO=(()=>{
  const T=THREE,V=(a)=>new T.Vector3(...a),UP=new T.Vector3(0,1,0);
  const sphere=new T.SphereGeometry(1,24,16),box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,20);
  // Fine lines running pole to pole on every muscle read as fibres, like an anatomical drawing.
  function fibres(){
    const c=document.createElement('canvas');c.width=256;c.height=8;const g=c.getContext('2d');
    g.fillStyle='#fff';g.fillRect(0,0,256,8);
    for(let x=0;x<256;x+=2){const v=150+Math.round(105*Math.abs(Math.sin(x*12.9898)*43758.5453%1));g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(x,0,1+(x%6===0?1:0),8)}
    const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(3,1);t.colorSpace=T.SRGBColorSpace;return t;
  }
  const fibre=fibres(),bump=fibres();bump.colorSpace=T.NoColorSpace;
  const muscle=color=>new T.MeshStandardMaterial({color,roughness:.62,metalness:.04,map:fibre,bumpMap:bump,bumpScale:1.4});
  const grey=muscle(0xd3d7dc),red=muscle(0xf0563a),helper=muscle(0xf3b7a6);
  const skin=new T.MeshStandardMaterial({color:0xcfd3d8,roughness:.7,metalness:.04});
  const contour=new T.MeshBasicMaterial({color:0x4a5059,side:T.BackSide});
  const dark=new T.MeshStandardMaterial({color:0x17191e,roughness:.86});
  const steel=new T.MeshStandardMaterial({color:0x737b83,roughness:.36,metalness:.65});
  const mat=new T.MeshStandardMaterial({color:0xe5e9ee,roughness:1});
  const skinDetail=new T.MeshStandardMaterial({color:0x8a919a,roughness:.85});
  const scene=new T.Scene();scene.background=new T.Color(0xffffff);
  scene.add(new T.HemisphereLight(0xffffff,0x9aa0a8,1.25));
  const key=new T.DirectionalLight(0xffffff,1.9);key.position.set(-70,130,90);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:350});key.shadow.bias=-.0005;scene.add(key);
  const fill=new T.DirectionalLight(0xeaf1ff,.7);fill.position.set(80,60,-100);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(240,240),new T.ShadowMaterial({opacity:.16}));ground.rotation.x=-Math.PI/2;ground.position.y=-2;ground.receiveShadow=true;scene.add(ground);
  const camera=new T.OrthographicCamera(-60,60,50,-50,.1,600);
  let renderer=null,failed=false;
  const meshes=new Map(),LINE=.34;
  function put(name,geometry,material,position,scale,rotation){
    let mesh=meshes.get(name);
    if(!mesh){mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);meshes.set(name,mesh);
      // A slightly larger back-facing shell draws the dark contour line around every form.
      const shell=new T.Mesh(geometry,contour);mesh.add(shell);mesh.userData.shell=shell}
    mesh.visible=true;mesh.material=material;mesh.position.copy(position);mesh.scale.set(...scale);mesh.quaternion.copy(rotation||new T.Quaternion());
    if(geometry===torso)mesh.userData.shell.scale.set(1.035,1.01,1.07);else mesh.userData.shell.scale.set((scale[0]+LINE)/scale[0],(scale[1]+LINE)/scale[1],(scale[2]+LINE)/scale[2]);return mesh;
  }
  function ell(name,pos,scale,material,rotation){return put(name,sphere,material,pos,scale,rotation)}
  function bone(name,a,b,width,depth,material){
    const delta=b.clone().sub(a),q=new T.Quaternion().setFromUnitVectors(UP,delta.clone().normalize());
    return ell(name,a.clone().lerp(b,.5),[width,delta.length()/2+.6,depth],material,q);
  }
  // Continuous torso silhouette, rather than a box or stack of joint balls.
  function torsoGeometry(){
    const rings=[[0,7.5,4.8],[.12,7,4.6],[.26,6.2,3.8],[.4,6.7,4],[.57,8.6,4.6],[.72,10.4,5.2],[.84,10.7,5],[.94,9.6,4.1],[1,6,3.2],[1.05,3,2.7]],verts=[],indices=[];
    rings.forEach(([h,w,d])=>{for(let i=0;i<48;i++){const angle=i/48*Math.PI*2;verts.push(Math.cos(angle)*w,h*28,Math.sin(angle)*d)}});
    for(let r=0;r<rings.length-1;r++)for(let i=0;i<48;i++){const a=r*48+i,b=r*48+(i+1)%48,c=a+48,d=b+48;indices.push(a,c,b,b,c,d)}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }
  const torso=torsoGeometry();
  const scalp=new T.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.48);
  function frame(ex,time,hl){
    for(const mesh of meshes.values())mesh.visible=false;
    const p=FigureMath.skeleton(ex,time),hip=V(p.hip),neck=V(p.neck),up=neck.clone().sub(hip).normalize(),right=new T.Vector3(1,0,0),front=right.clone().cross(up).normalize();
    const orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,front)),length=neck.distanceTo(hip),height=length/28;
    const local=(x,y,z)=>hip.clone().addScaledVector(right,x).addScaledVector(up,y*height).addScaledVector(front,z);
    let primary=new Set(({chest:['chest'],back:['back'],shoulders:['shoulders'],arms:[ex.mv==='pull'?'biceps':'triceps'],core:['abs'],legs:['quads','glutes'],cardio:[]})[ex.g]||[]);
    if(['deadlift','singlerdl'].includes(ex.id))primary=new Set(['hamstrings','glutes']);
    if(['bridge','donkey'].includes(ex.id))primary=new Set(['glutes']);
    const second=new Set((ex.also||[]).flatMap(g=>({chest:['chest'],back:['back'],shoulders:['shoulders'],arms:['biceps','triceps'],core:['abs'],legs:['quads','glutes']})[g]||[]));
    if(ex.g==='arms'&&ex.mv==='pull')second.add('forearms');if(ex.g==='legs'&&!primary.has('hamstrings'))second.add('calves');
    const tone=part=>!hl?grey:primary.has(part)?red:second.has(part)?helper:grey;
    put('torso',torso,skin,hip,[1,height,1],orientation);
    // Trunk: every visible muscle is its own surface so it can be shaded and highlighted separately.
    for(const side of [-1,1]){
      ell('trap'+side,local(side*4.2,27.6,-1.6),[5.2,2.3*height,2.9],tone('back'),orientation);
      ell('pecU'+side,local(side*4.9,22.6,4.2),[4.7,2.5*height,1.75],tone('chest'),orientation);
      ell('pecL'+side,local(side*4.5,20.2,4.5),[4.3,2.6*height,1.9],tone('chest'),orientation);
      ell('lat'+side,local(side*7.6,15.6,-2.6),[2.9,7.6*height,2.5],tone('back'),orientation);
      ell('scapula'+side,local(side*4.9,22,-4.2),[4.2,4.4*height,1.3],tone('back'),orientation);
      ell('erector'+side,local(side*1.9,8.5,-3.9),[1.7,6.2*height,1.2],tone('back'),orientation);
      for(let i=0;i<4;i++)ell('abs'+side+i,local(side*1.75,5.6+i*3.25,3.9-(i===0?.3:0)),[1.7,1.5*height,.8],tone('abs'),orientation);
      for(let i=0;i<3;i++)ell('serratus'+side+i,local(side*(6.9-i*.45),15.8+i*2,3.6),[1.5,.95*height,.6],tone('abs'),orientation);
      ell('oblique'+side,local(side*4.7,9.6,2.6),[1.9,4.6*height,1.5],tone('abs'),orientation);
      bone('clavicle'+side,local(side*1,27.4,2.7),local(side*8.2,27.9,1.4),.62,.62,skinDetail);
      bone('scm'+side,local(side*.9,27.6,2.4),local(side*3.4,33.2,-.4),.7,.7,skin);
    }
    const head=local(0,35.1,.1);
    bone('neck',neck,local(0,31.2,0),2.8,2.6,skin);
    ell('head',head,[4.3,5.3,4.1],skin,orientation);
    put('hair',scalp,dark,head.clone().addScaledVector(up,.35),[4.42,5.3,4.2],orientation);
    ell('jaw',local(0,31.9,2.1),[3.1,2,2.1],skin,orientation);
    ell('nose',local(0,34.6,4.3),[.7,1.3,1],skin,orientation);
    ell('mouth',local(0,32.3,3.95),[1.2,.16,.3],skinDetail,orientation);
    for(const side of [-1,1]){
      ell('ear'+side,local(side*4.3,34.4,.1),[.6,1.25,.8],skin,orientation);
      ell('brow'+side,local(side*1.7,36.15,3.7),[1.15,.26,.5],dark,orientation);
      ell('eye'+side,local(side*1.7,35.6,3.8),[.55,.22,.25],dark,orientation);
    }
    ell('shorts',hip.clone().addScaledVector(up,-.2),[7.8,3.5,5.1],dark,orientation);
    for(let i=0;i<2;i++){
      const [h,k,f]=p.legs[i].map(V),thigh=k.clone().sub(h),thighUp=thigh.clone().normalize(),out=i?-1:1,TL=thigh.length();
      // Local frame of the thigh so the muscles stay on the right faces as the leg swings.
      let tf=front.clone().addScaledVector(thighUp,-front.dot(thighUp));if(tf.lengthSq()<.02)tf=up.clone().addScaledVector(thighUp,-up.dot(thighUp));tf.normalize();
      const ts=thighUp.clone().cross(tf).normalize().multiplyScalar(-1),q=new T.Quaternion().setFromUnitVectors(UP,thighUp),on=(t,s,fz)=>h.clone().lerp(k,t).addScaledVector(ts,s*out).addScaledVector(tf,fz);
      bone('thigh'+i,h,k,3.9,3.9,skin);
      ell('rectus'+i,on(.45,0,2.5),[2.3,TL*.4,1.9],tone('quads'),q);
      ell('vastusL'+i,on(.5,2.5,1.2),[2.2,TL*.36,2.2],tone('quads'),q);
      ell('vastusM'+i,on(.74,-1.9,1.7),[1.9,TL*.2,1.7],tone('quads'),q);
      ell('adductor'+i,on(.3,-2.4,-.2),[2,TL*.3,2.4],skin,q);
      ell('hamL'+i,on(.5,1.5,-2.4),[1.9,TL*.38,1.7],tone('hamstrings'),q);
      ell('hamM'+i,on(.5,-1.3,-2.5),[1.8,TL*.37,1.6],tone('hamstrings'),q);
      ell('glute'+i,h.clone().addScaledVector(front,-3).addScaledVector(up,-1.6).addScaledVector(right,out*.6),[4.1,4.2,2.9],tone('glutes'),orientation);
      bone('shortleg'+i,h,h.clone().lerp(k,.27),4.9,5,dark);
      ell('knee'+i,k,[2.5,2.4,2.6],skin);
      const shinUp=f.clone().sub(k).normalize();let sf=tf.clone().addScaledVector(shinUp,-tf.dot(shinUp));if(sf.lengthSq()<.02)sf=front.clone();sf.normalize();
      const ss=shinUp.clone().cross(sf).normalize().multiplyScalar(-1),SL=k.distanceTo(f),sq=new T.Quaternion().setFromUnitVectors(UP,shinUp),sn=(t,s,fz)=>k.clone().lerp(f,t).addScaledVector(ss,s*out).addScaledVector(sf,fz);
      ell('patella'+i,k.clone().addScaledVector(sf,2),[1.5,1.6,.9],skinDetail,sq);
      bone('shin'+i,k,f,2,2,skin);
      ell('calfL'+i,sn(.3,1,-1.5),[1.8,SL*.27,1.9],tone('calves'),sq);
      ell('calfM'+i,sn(.33,-1,-1.6),[1.9,SL*.29,2],tone('calves'),sq);
      ell('tibialis'+i,sn(.42,.7,1.1),[1.2,SL*.33,1.1],skin,sq);
      // Foot: heel, arch and toes, pointing the way the shin faces.
      const toe=sf.clone().addScaledVector(UP,-sf.y);if(toe.lengthSq()<.05)toe.copy(front);toe.normalize();
      const fq=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),toe);
      ell('heel'+i,f.clone().addScaledVector(toe,-.6).add(new T.Vector3(0,.2,0)),[1.9,1.8,2],skin,fq);
      ell('foot'+i,f.clone().addScaledVector(toe,2.8).add(new T.Vector3(0,-.3,0)),[2.1,1.25,3.6],skin,fq);
      ell('toes'+i,f.clone().addScaledVector(toe,6).add(new T.Vector3(0,-.7,0)),[2.2,.8,1.3],skinDetail,fq);
    }
    for(let i=0;i<2;i++){
      const [s,e,h]=p.arms[i].map(V),armUp=e.clone().sub(s).normalize(),q=new T.Quaternion().setFromUnitVectors(UP,armUp),UL=s.distanceTo(e),out=i?-1:1;
      let af=front.clone().addScaledVector(armUp,-front.dot(armUp));if(af.lengthSq()<.02)af=up.clone().addScaledVector(armUp,-up.dot(armUp));af.normalize();
      const as=armUp.clone().cross(af).normalize().multiplyScalar(-1),on=(t,sd,fz)=>s.clone().lerp(e,t).addScaledVector(as,sd*out).addScaledVector(af,fz);
      bone('upperarm'+i,s,e,2.5,2.5,skin);
      ell('deltF'+i,s.clone().addScaledVector(front,1.5).addScaledVector(up,-.3),[3.2,4.1,2.6],tone('shoulders'),orientation);
      ell('deltS'+i,s.clone().addScaledVector(right,out*1.3).addScaledVector(up,-.2),[3.2,4.4,3.3],tone('shoulders'),orientation);
      ell('deltR'+i,s.clone().addScaledVector(front,-1.6).addScaledVector(up,-.4),[3.1,3.9,2.5],tone('shoulders'),orientation);
      ell('biceps'+i,on(.52,0,1.6),[2.4,UL*.36,1.9],tone('biceps'),q);
      ell('brachialis'+i,on(.72,1.5,.6),[1.3,UL*.2,1.3],tone('biceps'),q);
      ell('tricepsL'+i,on(.45,1.2,-1.4),[1.9,UL*.38,1.8],tone('triceps'),q);
      ell('tricepsM'+i,on(.5,-.9,-1.5),[1.8,UL*.36,1.7],tone('triceps'),q);
      ell('elbow'+i,e,[2.1,2,2.1],skin);
      const foreUp=h.clone().sub(e).normalize(),fqr=new T.Quaternion().setFromUnitVectors(UP,foreUp),FL=e.distanceTo(h);
      let ff=af.clone().addScaledVector(foreUp,-af.dot(foreUp));if(ff.lengthSq()<.02)ff=front.clone().addScaledVector(foreUp,-front.dot(foreUp));ff.normalize();
      const fs=foreUp.clone().cross(ff).normalize().multiplyScalar(-1),fo=(t,sd,fz)=>e.clone().lerp(h,t).addScaledVector(fs,sd*out).addScaledVector(ff,fz);
      bone('forearm'+i,e,h,1.75,1.75,skin);
      ell('brachiorad'+i,fo(.3,1.1,.5),[1.5,FL*.3,1.5],tone('forearms'),fqr);
      ell('flexor'+i,fo(.34,-.9,.3),[1.6,FL*.32,1.6],tone('forearms'),fqr);
      ell('extensor'+i,fo(.36,.2,-1),[1.3,FL*.3,1.2],tone('forearms'),fqr);
      ell('wrist'+i,fo(.94,0,0),[1.5,1.2,1.2],skin,fqr);
      ell('hand'+i,h,[1.9,2.4,1.25],skin,fqr);
      ell('thumb'+i,h.clone().addScaledVector(fs,-1.9*out).addScaledVector(foreUp,.2),[.62,1.5,.7],skin,fqr);
      for(let finger=0;finger<4;finger++)ell('finger'+i+finger,h.clone().addScaledVector(fs,(finger-1.5)*.92).addScaledVector(foreUp,2.2).addScaledVector(ff,.5),[.46,1.5,.6],skin,fqr);
      if(ex.db&&(!ex.singleBell||i===0)){
        const hand=ex.singleBell?V(p.arms[0][2]).lerp(V(p.arms[1][2]),.5):h;
        put('handle'+i,cylinder,steel,hand,[.85,10,.85],new T.Quaternion().setFromUnitVectors(UP,right));
        for(const side of [-1,1]){
          put('plate'+i+side,cylinder,dark,hand.clone().addScaledVector(right,side*5.6),[4.4,2.6,4.4],new T.Quaternion().setFromUnitVectors(UP,right));
          put('cap'+i+side,cylinder,steel,hand.clone().addScaledVector(right,side*7.2),[1.5,.8,1.5],new T.Quaternion().setFromUnitVectors(UP,right));
        }
      }
    }
    // Equipment is an actual 3D object and belongs only to matching exercises.
    if(ex.poses.some(q=>q.p[1]>=78||q.a[1][1]>=86))put('mat',box,mat,new T.Vector3(0,-1,0),[34,.8,112]);
    if(ex.prop&&ex.prop.chair){
      const z=(ex.prop.chair[0]+12-60)*p.flip;
      put('seat',box,dark,new T.Vector3(0,18,z),[28,2.5,26]);
      for(const x of [-11,11])for(const zz of [-10,10])put('chairleg'+x+zz,box,steel,new T.Vector3(x,8,z+zz),[1.8,18,1.8]);
    }
    if(ex.prop&&ex.prop.wall)put('wall',box,mat,new T.Vector3(0,42,(ex.prop.wall-3-60)*p.flip),[40,88,1.5]);
    return p;
  }
  function draw(cv,ex,time,hl,view){
    const width=Math.max(1,Math.round(cv.clientWidth*Math.min(devicePixelRatio||1,2))),height=Math.max(1,Math.round(cv.clientHeight*Math.min(devicePixelRatio||1,2)));
    if(cv.width!==width||cv.height!==height){cv.width=width;cv.height=height}
    const context=cv.getContext('2d');
    if(!renderer&&!failed){try{renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping}catch(error){failed=true;console.warn('3D exercise demos unavailable',error)}}
    if(failed){context.fillStyle='#ffffff';context.fillRect(0,0,width,height);context.fillStyle='#374151';context.font=`${Math.max(12,width/24)}px sans-serif`;context.fillText('3D demo unavailable on this device',width*.05,height*.5);return}
    frame(ex,time,hl);
    const grounded=ex.poses.every(p=>p.n[1]>55),center=new T.Vector3(0,grounded?15:39,0),span=grounded?90:94,aspect=width/height;
    camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
    const eye=view==='front'?new T.Vector3(0,40,170):view==='side'?new T.Vector3(170,40,0):new T.Vector3(130,100,150);
    camera.position.copy(center).add(eye);camera.lookAt(center);camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);renderer.render(scene,camera);context.clearRect(0,0,width,height);context.drawImage(renderer.domElement,0,0);
  }
  return {draw};
})();
const FIG_STATE=new WeakMap();let figureTick=0;
function figLoop(ms){
  if(ms-figureTick>=33&&document.visibilityState!=='hidden'){
    figureTick=ms;
    document.querySelectorAll('canvas[data-ex]').forEach(cv=>{
      const rect=cv.getBoundingClientRect();if(!rect.width||rect.bottom<0||rect.top>innerHeight)return;
      const ex=exById(cv.dataset.ex);if(!ex)return;
      const live=cv.hasAttribute('data-paused'),paused=!live||cv.dataset.paused==='1';
      let state=FIG_STATE.get(cv);if(!state){state={last:ms,t:0,signature:''};FIG_STATE.set(cv,state)}
      if(cv.dataset.restart){state.t=0;state.signature='';delete cv.dataset.restart}
      if(!paused)state.t+=Math.min(100,ms-state.last)/1000*(cv.dataset.slow?.3:1);state.last=ms;
      const signature=[rect.width,rect.height,cv.dataset.ex,cv.dataset.hl,cv.dataset.view,state.t].join('|');
      if(signature!==state.signature){DEMO.draw(cv,ex,state.t,cv.dataset.hl!=='0',cv.dataset.view||'isometric');state.signature=signature}
    });
  }
  requestAnimationFrame(figLoop);
}

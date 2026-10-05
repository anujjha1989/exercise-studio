'use strict';
/* One orthographic 3D renderer, shared across all preview canvases. Geometry is
   source-owned; no copied model or remote runtime assets. Library previews are
   still images; only the open demo is animated, capped at 30 fps. */
const DEMO=(()=>{
  const T=THREE,V=(a)=>new T.Vector3(...a),UP=new T.Vector3(0,1,0);
  const sphere=new T.SphereGeometry(1,24,16),box=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,20);
  const grey=new T.MeshStandardMaterial({color:0xb6bbc2,roughness:.74,metalness:.08});
  const red=new T.MeshStandardMaterial({color:0xe86a5b,roughness:.8});
  const helper=new T.MeshStandardMaterial({color:0xeeb6aa,roughness:.8});
  const dark=new T.MeshStandardMaterial({color:0x17191e,roughness:.86});
  const steel=new T.MeshStandardMaterial({color:0x737b83,roughness:.36,metalness:.65});
  const mat=new T.MeshStandardMaterial({color:0xe5e9ee,roughness:1});
  const skinDetail=new T.MeshStandardMaterial({color:0x969da6,roughness:.85});
  const scene=new T.Scene();scene.background=new T.Color(0xffffff);
  scene.add(new T.HemisphereLight(0xffffff,0x858a91,1.2));
  const key=new T.DirectionalLight(0xffffff,2.3);key.position.set(-70,130,90);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:350});key.shadow.bias=-.0005;scene.add(key);
  const fill=new T.DirectionalLight(0xeaf1ff,1);fill.position.set(80,60,-100);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(240,240),new T.ShadowMaterial({opacity:.16}));ground.rotation.x=-Math.PI/2;ground.position.y=-2;ground.receiveShadow=true;scene.add(ground);
  const camera=new T.OrthographicCamera(-60,60,50,-50,.1,600);
  let renderer=null,failed=false;
  const meshes=new Map();
  function put(name,geometry,material,position,scale,rotation){
    let mesh=meshes.get(name);
    if(!mesh){mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);meshes.set(name,mesh)}
    mesh.visible=true;mesh.material=material;mesh.position.copy(position);mesh.scale.set(...scale);mesh.quaternion.copy(rotation||new T.Quaternion());return mesh;
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
    for(let r=0;r<rings.length-1;r++)for(let i=0;i<48;i++){const a=r*48+i,b=r*48+(i+1)%48,c=a+48,d=b+48;indices.push(a,b,c,b,d,c)}
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
    const tone=part=>!hl?grey:primary.has(part)?red:second.has(part)?helper:grey;
    put('torso',torso,grey,hip,[1,height,1],orientation);
    // Pectorals, serratus, abdominal sections and back are independent surfaces.
    for(const side of [-1,1]){
      ell('pec'+side,local(side*4.65,21,4.35),[4.6,3.65*height,1.7],tone('chest'),orientation);
      ell('lat'+side,local(side*7.5,15.8,-3),[2.8,7.5*height,2.2],tone('back'),orientation);
      ell('scapula'+side,local(side*4.8,22,-4.15),[4.1,4.5*height,1.25],tone('back'),orientation);
      for(let i=0;i<3;i++){
        ell('abs'+side+i,local(side*1.8,9+i*3.5,3.7),[1.72,1.65*height,.72],tone('abs'),orientation);
        ell('serratus'+side+i,local(side*(6.6-i*.4),16.5+i*2.1,3.9),[1.35,1*height,.55],tone('abs'),orientation);
      }
      ell('oblique'+side,local(side*4.3,10.5,2.75),[1.7,4.3*height,1.2],tone('abs'),orientation);
    }
    const head=local(0,35.1,.1);
    bone('neck',neck,local(0,31.2,0),2.8,2.6,grey);
    ell('head',head,[4.4,5.4,4],grey,orientation);
    ell('hair',head.clone().addScaledVector(up,.3),[4.48,5.35,4.08],dark,orientation).geometry=scalp;
    ell('jaw',local(0,31.9,2.2),[3.2,2,2],grey,orientation);
    ell('nose',local(0,34.8,4.25),[.75,1.3,1.05],grey,orientation);
    for(const side of [-1,1]){
      ell('ear'+side,local(side*4.4,34.5,.1),[.62,1.25,.75],grey,orientation);
      ell('brow'+side,local(side*1.7,36.25,3.6),[1.1,.28,.5],skinDetail,orientation);
      ell('eye'+side,local(side*1.7,35.8,3.65),[.55,.2,.25],dark,orientation);
    }
    ell('shorts',hip.clone().addScaledVector(up,-.2),[7.7,3.4,5.05],dark,orientation);
    for(let i=0;i<2;i++){
      const [h,k,f]=p.legs[i].map(V),thigh=k.clone().sub(h),thighUp=thigh.clone().normalize(),legFront=front;
      bone('thigh'+i,h,k,4.5,4.4,grey);
      const center=h.clone().lerp(k,.47),q=new T.Quaternion().setFromUnitVectors(UP,thighUp);
      ell('quad'+i,center.clone().addScaledVector(legFront,2.2),[3.6,thigh.length()*.41,2.1],tone('quads'),q);
      ell('outerquad'+i,center.clone().addScaledVector(right,i?-2:2).addScaledVector(legFront,.7),[2.5,thigh.length()*.36,2.3],tone('quads'),q);
      ell('hamstring'+i,center.clone().addScaledVector(legFront,-2.3),[3,thigh.length()*.38,1.8],tone('hamstrings'),q);
      ell('glute'+i,h.clone().addScaledVector(front,-2.9).addScaledVector(up,-1.8),[4,4.1,2.7],tone('glutes'),orientation);
      bone('shortleg'+i,h,h.clone().lerp(k,.25),4.7,4.8,dark);
      ell('knee'+i,k,[2.7,2.5,2.8],grey);
      bone('shin'+i,k,f,2.2,2.1,grey);
      const calf=k.clone().lerp(f,.38),shinLength=k.distanceTo(f),sq=new T.Quaternion().setFromUnitVectors(UP,f.clone().sub(k).normalize());
      ell('calf'+i,calf.clone().addScaledVector(front,-1.2),[2.85,shinLength*.28,2.2],grey,sq);
      ell('foot'+i,f.clone().add(new T.Vector3(0,0,2.3)),[2.3,1.8,4.7],grey);
    }
    for(let i=0;i<2;i++){
      const [s,e,h]=p.arms[i].map(V),q=new T.Quaternion().setFromUnitVectors(UP,e.clone().sub(s).normalize()),center=s.clone().lerp(e,.48),upperLength=s.distanceTo(e);
      bone('upperarm'+i,s,e,2.8,2.8,grey);
      ell('deltoid'+i,s,[4,4.4,3.6],tone('shoulders'),orientation);
      ell('biceps'+i,center.clone().addScaledVector(front,1.7),[2.7,upperLength*.39,1.8],tone('biceps'),q);
      ell('triceps'+i,center.clone().addScaledVector(front,-1.4),[2.6,upperLength*.42,1.9],tone('triceps'),q);
      ell('elbow'+i,e,[2.35,2.1,2.2],grey);
      bone('forearm'+i,e,h,2.2,2.25,grey);
      bone('forearmflex'+i,e.clone().lerp(h,.05).addScaledVector(front,1),e.clone().lerp(h,.72).addScaledVector(front,1),1.55,1.1,grey);
      ell('hand'+i,h,[1.95,2.9,1.35],grey,q);
      for(let finger=0;finger<3;finger++)ell('finger'+i+finger,h.clone().addScaledVector(right,(finger-1)*.95).addScaledVector(up,-1),[.5,1.9,.72],grey,q);
      if(ex.db&&(!ex.singleBell||i===0)){
        const hand=ex.singleBell?V(p.arms[0][2]).lerp(V(p.arms[1][2]),.5):h;
        put('handle'+i,cylinder,steel,hand,[.85,10,.85],new T.Quaternion().setFromUnitVectors(UP,right));
        for(const side of [-1,1])put('plate'+i+side,cylinder,dark,hand.clone().addScaledVector(right,side*5.8),[4.4,2.8,4.4],new T.Quaternion().setFromUnitVectors(UP,right));
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
    if(!renderer&&!failed){try{renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05}catch(error){failed=true;console.warn('3D exercise demos unavailable',error)}}
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

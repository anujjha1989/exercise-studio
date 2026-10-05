const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const math=require('../public/figure-math.js');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('public/data.js','utf8')+';this.exercises=EX',context);
test('every exercise produces finite 3D joints throughout its complete loop',()=>{
  for(const ex of context.exercises)for(let step=0;step<=ex.poses.length*8;step++){
    const pose=math.skeleton(ex,step*math.beat(ex)/8);
    for(const point of [pose.neck,pose.hip,...pose.arms.flat(),...pose.legs.flat()]){
      assert.equal(point.length,3,ex.id);assert.ok(point.every(Number.isFinite),ex.id);
    }
    for(const chain of [...pose.arms,...pose.legs])for(let i=1;i<chain.length;i++)assert.ok(Math.hypot(...chain[i].map((v,j)=>v-chain[i-1][j]))>.1,ex.id+' has a collapsed limb');
  }
});
test('pose loops return to their start and preserve floor height',()=>{
  for(const ex of context.exercises){
    assert.deepEqual(math.skeleton(ex,0),math.skeleton(ex,ex.poses.length*math.beat(ex)),ex.id);
    const p=math.interpolate(ex,0),s=math.skeleton(ex,0);
    assert.equal(s.legs[0][2][1],90-p.l[1][1],ex.id);
  }
});

const test=require('node:test');const assert=require('node:assert/strict');
const W=require('../public/workout.js');
test('a single set and a zero-set workout never count as complete',()=>{
  const day={entries:[],plan:{ids:['pushup','row'],sets:2}};
  assert.equal(W.status(day),'cancelled');
  day.entries=[{ex:'pushup',sets:[{r:8}]}];assert.equal(W.status(day),'partial');
  day.entries[0].sets.push({r:8});day.entries.push({ex:'row',sets:[{r:8},{r:8}]});assert.equal(W.status(day),'completed');
  day.entries[1].sets.pop();assert.equal(W.status(day),'partial');
});
test('unilateral targets require both sides, while legacy paired sets are retained',()=>{
  const day={plan:{ids:['row'],sets:2,unilateral:['row']},entries:[{ex:'row',sets:[{r:8,side:'left'},{r:8,side:'left'}]}]};
  assert.equal(W.setCount(day,'row'),0);assert.equal(W.status(day),'partial');
  day.entries[0].sets.push({r:8,side:'right'},{r:8,side:'right'});assert.equal(W.status(day),'completed');
  day.entries[0].sets=[{r:8},{r:8}];assert.equal(W.status(day),'completed');
});
test('equipment, experience, exclusions and impact constrain selection',()=>{
  const p={dbs:[],chair:false,experience:'beginner',lowImpact:true,excluded:['curl']};
  assert.equal(W.eligible({eq:'db'},p),false);assert.equal(W.eligible({prop:{chair:[1]}},p),false);
  assert.equal(W.eligible({level:'advanced'},p),false);assert.equal(W.eligible({impact:'high'},p),false);
  assert.equal(W.eligible({id:'curl'},p),false);assert.equal(W.eligible({eq:'bw'},p),true);
  assert.equal(W.eligible({eq:'db'},{...p,dbs:[5]}),true);
});
test('pause duration is excluded and remains frozen while paused',()=>{
  const p={t0:1000,pausedMs:500,pausedAt:4000};assert.equal(W.elapsed(p,10000),2500);
  p.pausedAt=0;p.pausedMs=6500;assert.equal(W.elapsed(p,11000),3500);
});
test('legacy workouts stay partial unless explicitly confirmed',()=>{
  const day={entries:[{ex:'curl',sets:[{r:8}]}]};assert.equal(W.status(day),'partial');
  day.completed=true;assert.equal(W.status(day),'completed');day.entries=[];assert.equal(W.status(day),'cancelled');
});
test('strength trends show actual load and reps, not inferred one-rep maximum',()=>{
  const days={'2026-01-02':{entries:[{ex:'curl',sets:[{r:10,kg:5},{r:8,kg:6}]}]},'2026-01-01':{entries:[{ex:'curl',sets:[{r:8,kg:5}]}]}};
  const points=W.trend(days,'curl');assert.deepEqual(points.map(x=>x.v),[5,6]);assert.equal(points[1].r,8);
});
test('weight trend uses only actual readings in the preceding seven days',()=>{
  const points=W.weightTrend([{d:'2026-01-01',kg:80},{d:'2026-01-03',kg:78},{d:'2026-01-20',kg:76}]);
  assert.deepEqual(points.map(p=>p.v),[80,79,76]);assert.equal(points.length,3);
});
test('time budget includes both sides and warm-up',()=>{
  const exercises=[{id:'row',unilateral:true},{id:'curl'},{id:'press'}];
  const sc={sets:2,rest:75};assert.deepEqual(W.fitTime(exercises,{minutes:15},sc).map(e=>e.id),['row','curl']);
  assert.ok(W.estimatedMinutes(3,2,75)<=15);
});

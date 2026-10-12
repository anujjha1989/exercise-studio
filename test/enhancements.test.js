const test=require('node:test'),assert=require('node:assert/strict'),W=require('../public/workout');
const scheme={sets:2,lo:8,hi:12,hold:30};
const day=sets=>({entries:[{ex:'curl',sets}]});
test('progression requires two qualifying sessions and an available higher weight',()=>{
 const days={'2026-10-01':day([{r:12,kg:5},{r:12,kg:5}]),'2026-10-03':day([{r:12,kg:5},{r:12,kg:5}])};
 assert.equal(W.recommendation(days,'curl','2026-10-04',scheme,[5,7.5]).kg,7.5);
 assert.equal(W.recommendation(days,'curl','2026-10-03',scheme,[5,7.5]).ready,false);
 days['2026-10-03'].entries[0].sets[1].r=10;
 assert.equal(W.recommendation(days,'curl','2026-10-04',scheme,[5,7.5]).kg,5);
});
test('unilateral progression requires both sides, substitutions preserve purpose and eligibility',()=>{
 const days={'2026-10-01':day(Array(4).fill({r:12,kg:5,side:'left'})),'2026-10-02':day(Array(4).fill({r:12,kg:5,side:'left'}))};
 assert.equal(W.recommendation(days,'curl','2026-10-03',scheme,[7],true).ready,false);
 const ex={id:'a',g:'arms',mv:'pull',eq:'bw'},p={dbs:[],chair:false};
 assert.deepEqual(W.substitutes(ex,[{...ex,id:'b'},{...ex,id:'c',mv:'push'},{...ex,id:'d',eq:'db'}],p).map(e=>e.id),['b']);
});
test('progress summary counts activity separately from completed workouts',()=>{
 const d=day([{r:8,kg:5}]);assert.deepEqual(W.summary({'2026-10-01':d},'2026-10-01').weekDays,1);assert.equal(W.summary({'2026-10-01':d},'2026-10-01').completed,0);
});

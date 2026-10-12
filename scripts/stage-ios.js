// Reuse canonical exercise definitions and pure planning rules in JavaScriptCore.
const fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8');
const segment=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a);if(a<0||b<0)throw Error('Shared rule boundaries changed');return app.slice(a,b)};
const source='var window=this;\n'+fs.readFileSync('public/workout.js','utf8')+'\n'+fs.readFileSync('public/figure-math.js','utf8')+'\n'+fs.readFileSync('public/data.js','utf8')+'\n'+segment('const pad=','const main=')+'\n'+segment('const defProfile=','function loadLocal()')+'\nvar P=null;\n'+segment('function exAll()','/* ================= derived numbers')+'\n'+segment('function snapshotPlan(','function dayStats(')+`\nvar NativeRules={
 timing:id=>JSON.stringify({beat:FigureMath.beat(exById(id)),poses:exById(id).poses.length}),
 pose:(id,time)=>JSON.stringify(FigureMath.skeleton(exById(id),time)),
 defaultProfile:()=>JSON.stringify(defProfile()),
 run:(state,method,args)=>{S.profile=fixProfile(state.profile);S.days=state.days||{};TODAY=args.date||ymd(new Date());
 let result;
 switch(method){
 case 'library':result=exAll();break;
 case 'plan':{const day=S.days[TODAY];const sess=planFor(TODAY);result=day&&day.plan?day.plan:sess?snapshotPlan(sess):null;break;}
 case 'train':result=snapshotPlan(buildSession(0,TODAY));break;
 case 'scheme':result=scheme();break;
 case 'status':result=Workout.status(args.day);break;
 case 'count':result=Workout.setCount(args.day,args.id);break;
 case 'weight':result=Workout.weightTrend(S.profile.weigh);break;
 case 'trend':result=Workout.trend(S.days,args.id).filter(p=>p.d<=TODAY);break;
 case 'recommendation':result=Workout.recommendation(S.days,args.id,TODAY,args.scheme||scheme(),S.profile.dbs,!!exById(args.id)?.unilateral);break;
 case 'summary':result=Workout.summary(S.days,TODAY);break;
 case 'substitutes':result=Workout.substitutes(exById(args.id),exAll(),S.profile,args.used||[]).map(e=>e.id);break;
 case 'flex':{const previous=S.profile;S.profile={...previous,minutes:args.minutes||previous.minutes,hasDumbbells:args.bodyweight?false:previous.hasDumbbells,dbs:args.bodyweight?[]:previous.dbs,chair:args.noChair?false:previous.chair};result=snapshotPlan(buildSession(Math.max(0,previous.days.indexOf(wdOf(TODAY))),TODAY));S.profile=previous;break;}
 case 'skeleton':result=FigureMath.skeleton(exById(args.id),args.time||0);break;
 }
 return JSON.stringify(result);
 }};`;
vm.runInNewContext(source,{Date,Math,JSON,Set});
fs.writeFileSync('ios/ExerciseStudio/Resources/shared-rules.js',source);
console.log('Staged canonical exercise, planning, status, trend and pose rules for iOS.');

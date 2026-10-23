import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createData,sampleTrack,angleDiff,clamp,sampleBranch} from '../src/data.js';
import {GameEngine,SAVE_KEY,ENDING_DURATION,endingStage} from '../src/engine.js';
const data=createData(JSON.parse(fs.readFileSync(new URL('../assets/haiphong-osm.json',import.meta.url))));
const fresh=()=>new GameEngine(data,{getItem:()=>null,setItem(){}});
const race=(options={})=>{const e=fresh();e.save.unlocked=5;e.start({track:6,carryEnabled:false,...options});e.state.phase='race';return e;};
const run=(e,seconds,input={},hz=120)=>{for(let i=0;i<seconds*hz;i++)e.update(1/hz,input);};
// These helpers test gate validation in isolation, not a driven lap.
const gate=(e,g)=>e._crossCheckpoint(g.x-g.tx*.4,g.y-g.ty*.4,g.x+g.tx*.4,g.y+g.ty*.4);
const gatesToFinish=e=>{const n=e.state.checkpoints.length;for(let i=1;i<=n;i++)gate(e,e.state.checkpoints[i%n]);};

test('V9 story has five rising opponents, named chapters and authored lighting',()=>{
 assert.deepEqual(data.levels.map(l=>l.opponent),['minh','nhi','phong','rin','lucien']);
 assert.deepEqual(data.levels.map(l=>l.time),['day','day','sunset','sunset','night']);
 for(let i=1;i<5;i++)assert.ok(data.levels[i].pace>data.levels[i-1].pace);
});
test('fixed simulation produces matching motion at 30, 60 and 120 render updates',()=>{
 const states=[30,60,120].map(hz=>{const e=race({track:0});run(e,2,{throttle:1,steer:.05},hz);return e.state.player;});
 for(const p of states.slice(1)){assert.ok(Math.hypot(p.x-states[0].x,p.y-states[0].y)<.001);assert.ok(Math.abs(p.speed-states[0].speed)<.001);assert.ok(Math.abs(p.lean-states[0].lean)<.001);}
});
test('active drift requires speed, steering and braking, then rewards a clean controlled release',()=>{
 const e=race({track:0});e.state.player.speed=18;run(e,.9,{throttle:1,steer:.28,brake:.12,drift:true});
 assert.equal(e.state.player.drifting,true);assert.ok(Math.abs(e.state.player.slip)>.01);assert.ok(e.state.player.driftCharge>5);
 e.update(1/120,{throttle:1});assert.equal(e.state.player.drifting,false);assert.ok(e.state.player.nitro>5);assert.ok(e.save.coins>0);assert.equal(e.state.player.combo,1);
 const cold=race();run(cold,.8,{drift:true,steer:1,brake:1});assert.equal(cold.save.coins,0);assert.equal(cold.state.player.nitro,0);
});
test('Nitro spends a finite reserve, boosts acceleration, stays bounded and grants no checkpoint',()=>{
 const a=race({track:0}),b=race({track:0});a.state.rivals=[];b.state.rivals=[];a.state.player.nitro=25;run(a,.8,{throttle:1,nitro:true});run(b,.8,{throttle:1});
 assert.ok(a.state.player.speed>b.state.player.speed+3);assert.ok(a.state.player.nitro<6);assert.equal(a.state.stats.checkpointsPassed,0);
 run(a,2,{nitro:true});assert.ok(a.state.player.nitro>=0);assert.equal(a.state.player.nitroActive,false);assert.ok(a.state.player.speed<=a.state.bike.max*1.13);
});
test('ending preview skips and finishes without any reward or save mutation, restoring exact race',()=>{
 const e=race(),old=e.state;run(e,1,{throttle:1});const before=JSON.stringify(e.save),elapsed=old.elapsed;
 assert.equal(e.previewEnding(),true);assert.equal(e.state.phase,'ending');run(e,5);assert.equal(e.state.ending.stage,'congratulate');
 assert.equal(e.previewEnding(),false);e.skipEnding();assert.equal(e.state.ending.complete,true);e.finishEnding();assert.equal(e.state,old);assert.equal(old.elapsed,elapsed);assert.equal(JSON.stringify(e.save),before);
 assert.equal(e.replayEnding(),false);
});
test('only a valid first-place boss finish grants the bracelet; replay does not duplicate currency',()=>{
 const e=race({mode:'story',level:4});e.state.player.totalProgress=e.state.track.length;e._finish();assert.equal(e.save.endingUnlocked,false);
 gatesToFinish(e);assert.equal(e.state.phase,'ending');assert.equal(e.state.result.valid,true);assert.equal(e.save.endingUnlocked,true);assert.equal(e.save.memories.heart_bracelet.id,'heart_bracelet');
 const coins=e.save.coins,received=e.save.memories.heart_bracelet.receivedAt;assert.equal(e._finish(),false);assert.equal(e.save.coins,coins);
 e.skipEnding();e.finishEnding();assert.equal(e.state.phase,'result');assert.equal(e.replayEnding(),true);run(e,47);assert.equal(e.state.ending.complete,true);assert.equal(e.state.ending.elapsed,ENDING_DURATION);e.finishEnding();assert.equal(e.save.coins,coins);assert.equal(e.save.memories.heart_bracelet.receivedAt,received);
 e.setNames({aurora:'Ánh Mai',lucien:'Hải Đăng'});assert.equal(e.save.memories.heart_bracelet.receivedAt,received);assert.equal(e.replayEnding(),true);assert.equal(e.state.characterNames.aurora,'Ánh Mai');
});
test('losing the boss and winning custom races never unlock the story gift',()=>{
 const e=race({mode:'story',level:4});e.state.rivals[0].finishTime=10;gatesToFinish(e);assert.equal(e.state.phase,'result');assert.equal(e.save.endingUnlocked,false);
 const c=race({track:4});gatesToFinish(c);assert.equal(c.save.endingUnlocked,false);
});
test('all six ending stages are deterministic and independent of race timers',()=>{
 assert.deepEqual([0,5,12,22,34,40,46].map(endingStage),['victory','congratulate','gift','ride','restaurant','dinner','memories']);
 const e=race();e.previewEnding();const elapsed=e.state.elapsed;run(e,23);assert.equal(e.state.ending.stage,'ride');assert.equal(e.state.elapsed,elapsed);assert.equal(e.state.result,null);
});
test('each later story route has an actual OSM branch with ordered gates and no credit for exit-only jumps',()=>{
 for(const track of [2,3,4]){const e=race({track}),b=e.state.branches[0];assert.ok(b,`map ${track} branch`);assert.ok(b.saving>0);e.state.checkpointIndex=b.mainIndices[0];
  gate(e,b.gates.at(-1));assert.equal(e.state.shortcut,null);assert.equal(e.state.stats.shortcuts,0);
  gate(e,b.gates[0]);assert.ok(e.state.shortcut);gate(e,b.gates.at(-1));assert.equal(e.state.stats.shortcuts,0);
  for(const g of b.gates.slice(1))gate(e,g);assert.equal(e.state.shortcut,null);assert.equal(e.state.stats.shortcuts,1);assert.equal(e.state.stats.checkpointsPassed,b.mainIndices.length);assert.equal(e.state.result,null);
 }
});
test('Lucien Chase is bounded to intermediate chapters, ends on escape and grants no ending',()=>{
 const e=race({mode:'story',level:2,carryEnabled:true});e.state.elapsed=81;e._updateChase(1/120);assert.equal(e.state.chase.active,true);e.state.chase.elapsed=15;e._updateChase(1/120);assert.equal(e.state.chase.active,false);assert.equal(e.save.endingUnlocked,false);
 for(const level of [0,4]){const b=race({mode:'story',level,carryEnabled:true});b.state.elapsed=100;b._updateChase(1/120);assert.equal(b.state.chase,null);}
});
test('AI takes continuous bounded speed steps and obeys bike limits without final-distance boosts',()=>{
 const e=race({mode:'story',level:4});for(let i=0;i<20000;i++){const r=e.state.rivals[0],x=r.x,y=r.y,v=r.speed;e.state.elapsed+=1/120;e._updateAI(1/120);assert.ok(r.speed<=e.state.bike.max*1.13+.001);assert.ok(r.speed-v<=(e.state.bike.acc+e.state.bike.nitroPower)/120+.001);assert.ok(Math.hypot(r.x-x,r.y-y)<1.1,'AI moves along route, including branch transitions');}
});
test('final boss completes its original route continuously with tactical branch use',()=>{
 const e=race({mode:'story',level:4});let sawBranch=false,maxMove=0;
 for(let i=0;i<120*1000&&e.state.rivals[0].finishTime===null;i++){const r=e.state.rivals[0],x=r.x,y=r.y;e.state.elapsed+=1/120;e._updateAI(1/120);sawBranch ||= !!r.branch;maxMove=Math.max(maxMove,Math.hypot(r.x-x,r.y-y));}
 const r=e.state.rivals[0];assert.ok(r.finishTime>250&&r.finishTime<1000);assert.equal(sawBranch,true);assert.ok(maxMove<.5);assert.ok(r.totalProgress>=e.state.track.length);
});

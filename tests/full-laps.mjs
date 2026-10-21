import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createData,sampleTrack,angleDiff,clamp} from '../src/data.js';
import {GameEngine} from '../src/engine.js';
const geo=JSON.parse(await readFile(new URL('../assets/haiphong-osm.json',import.meta.url),'utf8'));const data=createData(geo);
for(let track=0;track<10;track++){
const e=new GameEngine(data,{getItem:()=>null,setItem(){}});e.start({track,carryEnabled:false,difficulty:.7});e.state.phase='race';
let maxSide=0;
for(let i=0;i<120*1200&&e.state.phase==='race';i++){
const p=e.state.player,t=e.state.track;
const aim=sampleTrack(t,p.progress+Math.max(6,p.speed*.7));
const before=sampleTrack(t,p.progress),after=sampleTrack(t,p.progress+30);
const err=angleDiff(Math.atan2(aim.y-p.y,aim.x-p.x),p.heading);
const curve=Math.abs(angleDiff(after.heading,before.heading));
const target=Math.max(5,Math.min(19,13/(1+curve*1.5)));
const input={steer:clamp(err*3,-1,1),throttle:p.speed<target?1:0,brake:p.speed>target+1?.4:0};
e.update(1/120,input);
}
assert.equal(e.state.phase,'result');assert.equal(e.state.result.valid,true);assert.equal(e.state.stats.penalties,0);
console.log(track,e.state.phase,e.state.elapsed.toFixed(1),'cp',e.state.checkpointIndex+'/'+e.state.checkpoints.length,'lap',e.state.lap,'progress',e.state.player.progress.toFixed(1),'stats',e.state.stats);
}

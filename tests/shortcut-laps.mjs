import assert from 'node:assert/strict';import fs from 'node:fs';
import{createData,sampleTrack,sampleBranch,nearestBranch,angleDiff,clamp}from'../src/data.js';import{GameEngine}from'../src/engine.js';
const data=createData(JSON.parse(fs.readFileSync(new URL('../assets/haiphong-osm.json',import.meta.url))));const results=[];
for(const track of[2,3,4]){
 const e=new GameEngine(data,{getItem:()=>null,setItem(){}});e.start({track,carryEnabled:false,difficulty:.7});e.state.phase='race';const branch=e.state.branches[0];let taking=false,taken=false;
 for(let i=0;i<120*1400&&e.state.phase==='race';i++){
  const p=e.state.player,t=e.state.track;
  if(!taken&&p.progress>branch.entry-16&&p.progress<branch.entry+20)taking=true;
  if(e.state.stats.shortcuts>0){taking=false;taken=true;}
  let aim,before,after;
  if(taking){const n=nearestBranch(branch,p.x,p.y);aim=sampleBranch(branch,n.branchProgress+Math.max(5,p.speed*.6));before=sampleBranch(branch,n.branchProgress);after=sampleBranch(branch,n.branchProgress+25);}
  else{aim=sampleTrack(t,p.progress+Math.max(6,p.speed*.7));before=sampleTrack(t,p.progress);after=sampleTrack(t,p.progress+30);}
  const error=angleDiff(Math.atan2(aim.y-p.y,aim.x-p.x),p.heading),curve=Math.abs(angleDiff(after.heading,before.heading)),target=Math.max(4,Math.min(17,11/(1+curve*1.6)));
  e.update(1/120,{steer:clamp(error*3,-1,1),throttle:p.speed<target?1:0,brake:p.speed>target+1?.4:0});
 }
 const s=e.state;results.push({track,phase:s.phase,time:s.elapsed,shortcuts:s.stats.shortcuts,valid:s.result?.valid,penalties:s.stats.penalties,checkpoints:s.stats.checkpointsPassed,required:s.checkpoints.length,progress:s.player.progress,pending:s.checkpointIndex,branch:s.shortcut});
 console.log(results.at(-1));assert.equal(s.phase,'result');assert.equal(s.result.valid,true);assert.equal(s.stats.shortcuts,1);assert.equal(s.stats.penalties,0);
}
fs.writeFileSync(new URL('../previews/v9/shortcut-laps.json',import.meta.url),JSON.stringify({method:'Input-only feedback driver; no position edits, no rescue or rewards injected',results},null,2));

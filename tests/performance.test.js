import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameMonitor,AdaptiveResolution,SpatialGrid,normalizeQuality} from '../src/performance.js';

test('frame monitor reports measured frame interval distribution rather than capping FPS',()=>{
 const m=new FrameMonitor(5);[8,8,8,8,40].forEach(t=>m.record(t,{physicsMs:2,aiMs:.4,renderMs:3,drawCount:80}));
 const s=m.snapshot();assert.equal(s.samples,5);assert.equal(s.meanFrameMs,14.4);assert.equal(s.fps,1000/14.4);assert.equal(s.minimumFPS,25);assert.equal(s.p95FrameMs,40);assert.equal(s.physicsMs,2);assert.equal(s.aiMs,.4);
 for(let i=0;i<10;i++)m.record(8);assert.equal(m.snapshot().fps,125);assert.equal(m.snapshot().samples,5);
});
test('adaptive resolution reduces rendering work under load without changing simulated time',()=>{
 const a=new AdaptiveResolution('balanced');for(let i=0;i<300;i++)a.update(33.333);
 assert.ok(a.scale<1&&a.scale>=.55);const reduced=a.scale*a.detail;for(let i=0;i<2000;i++)a.update(8.333);assert.ok(a.scale*a.detail>reduced);assert.ok(a.scale<=1);
 assert.equal(normalizeQuality('high'),'balanced');assert.equal(normalizeQuality('low'),'performance');
});
test('spatial grid retrieves local candidates and reuses output arrays',()=>{
 const s=new SpatialGrid(10),a={x:2,y:3},b={x:200,y:300};s.insert(a);s.insert(b);const out=[];
 assert.equal(s.query(0,0,15,out),out);assert.deepEqual(out,[a]);s.query(200,300,1,out);assert.deepEqual(out,[b]);
});

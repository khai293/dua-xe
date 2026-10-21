import assert from 'node:assert/strict';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const origin = process.env.GAME_URL || 'http://127.0.0.1:4173';
const preview = new URL('../previews/', import.meta.url);
await mkdir(preview, {recursive:true});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page = await context.newPage();
const errors = [], failedRequests = [], tests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failedRequests.push(`${response.status()} ${response.url()}`);});
const snapshot = async name => page.screenshot({path:new URL(name,preview).pathname,fullPage:false});
const ready = async target => {
  await target.goto(`${origin}/?test=1`,{waitUntil:'networkidle'});
  await target.waitForFunction(()=>window.HPGP?.engine && window.HPGP?.ui && !document.querySelector('#menu').hidden,{timeout:30000});
};
const tick = async (seconds=4) => page.evaluate(seconds=>{for(let i=0;i<seconds*10;i++) HPGP.engine.update(.1,{});},seconds);
const inMenu = async () => {await page.evaluate(()=>{HPGP.engine.toMenu();HPGP.ui.showMenu();});await page.waitForTimeout(50);};
const test = async(name,fn)=>{const started=Date.now();try{const evidence=await fn();tests.push({name,status:'passed',ms:Date.now()-started,evidence});console.log(`PASS ${name}`);}catch(error){tests.push({name,status:'failed',ms:Date.now()-started,error:error.stack});console.error(`FAIL ${name}: ${error.message}`);}};
try {
  await ready(page);
  await test('boot: assets, four bikes and ten selectable custom maps',async()=>{
    assert.equal(await page.locator('.vehicle-choice').count(),4);
    assert.equal(await page.locator('.route-choice').count(),10);
    assert.match(await page.title(),/V8/);
    const state=await page.evaluate(()=>({phase:HPGP.engine.state.phase,tracks:HPGP.data.tracks.length,levels:HPGP.data.levels.length,canvas:document.querySelector('#game').width}));
    assert.equal(state.phase,'menu');assert.equal(state.tracks,10);assert.equal(state.levels,5);assert.ok(state.canvas>0);
    await snapshot('menu.png');return state;
  });
  await test('all four vehicle buttons select actual gameplay configuration',async()=>{
    for(let i=0;i<4;i++){
      await inMenu();await page.locator(`[data-vehicle="${i}"]`).click();await page.locator('#startButton').click();
      assert.equal(await page.evaluate(()=>HPGP.engine.state.config.vehicle),i);
    }
  });
  await test('all ten routes start through the custom-race menu',async()=>{
    for(let i=0;i<10;i++){
      await inMenu();await page.locator('#customMode').click();await page.locator(`[data-route="${i}"]`).click();await page.locator('#startButton').click();
      const result=await page.evaluate(()=>({track:HPGP.engine.state.track.index,phase:HPGP.engine.state.phase,checkpoints:HPGP.engine.state.checkpoints.length}));
      assert.equal(result.track,i);assert.equal(result.phase,'countdown');assert.ok(result.checkpoints>=10);
    }
    return {routes:10};
  });
  await test('five story chapters load via existing save progression and preserve dialogue',async()=>{
    await inMenu();await page.evaluate(()=>{HPGP.engine.save.unlocked=5;});await page.locator('#storyMode').click();
    assert.equal(await page.locator('.route-choice').count(),5);
    for(let i=0;i<5;i++){
      await inMenu();await page.locator('#storyMode').click();await page.locator(`[data-route="${i}"]`).click();await page.locator('#startButton').click();
      await page.waitForFunction(()=>!document.querySelector('#storyScreen').hidden);
      assert.ok((await page.locator('#storyText').innerText()).length>15);
      if(i===0){await snapshot('aurora.png');await page.locator('#nextStory').click();await snapshot('lucien.png');}
      await page.locator('#skipStory').click();assert.equal(await page.evaluate(()=>HPGP.engine.state.config.level),i);
      assert.equal(await page.evaluate(()=>HPGP.engine.state.phase),'countdown');
    }
    return {chapters:5,note:'save unlock was a test fixture; no claim of five player-won races'};
  });
  await test('keyboard acceleration and steering move the physical bike; no-input waits do not auto-drive',async()=>{
    await inMenu();await page.locator('#customMode').click();await page.locator('[data-route="0"]').click();await page.locator('[data-vehicle="2"]').click();await page.locator('#startButton').click();await tick();
    const initial=await page.evaluate(()=>({...HPGP.engine.state.player}));
    await page.waitForTimeout(250);const still=await page.evaluate(()=>({...HPGP.engine.state.player}));
    assert.ok(Math.hypot(still.x-initial.x,still.y-initial.y)<.001);
    await page.keyboard.down('w');await page.waitForTimeout(900);await page.keyboard.up('w');
    const moving=await page.evaluate(()=>({...HPGP.engine.state.player}));assert.ok(moving.speed>1);assert.ok(Math.hypot(moving.x-still.x,moving.y-still.y)>1);
    await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');
    const turned=await page.evaluate(()=>({...HPGP.engine.state.player}));assert.ok(Math.abs(turned.heading-moving.heading)>.001);
    await snapshot('race-day.png');return {movedMetres:Math.hypot(moving.x-still.x,moving.y-still.y),speed:moving.speed};
  });
  await test('pause/resume, camera and live weather/light settings work',async()=>{
    await page.locator('#pauseButton').click();assert.equal(await page.evaluate(()=>HPGP.engine.state.phase),'paused');
    const before=await page.evaluate(()=>HPGP.engine.state.elapsed);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>HPGP.engine.state.elapsed),before);
    await page.locator('#resumeButton').click();assert.equal(await page.evaluate(()=>HPGP.engine.state.phase),'race');
    const camera=await page.evaluate(()=>HPGP.engine.state.cameraMode);await page.locator('#cameraButton').click();assert.notEqual(await page.evaluate(()=>HPGP.engine.state.cameraMode),camera);
    await page.locator('#raceSettingsButton').click();await page.locator('#timeSelect').selectOption('night');await page.locator('#weatherSelect').selectOption('rain');await page.locator('#closeSettings').click();
    assert.deepEqual(await page.evaluate(()=>HPGP.engine.state.environment),{time:'night',weather:'rain'});
    await page.waitForTimeout(100);await snapshot('race-night.png');
  });
  await test('preview carry and kiss leave persistence unchanged; Skip exits the state machine',async()=>{
    await inMenu();const before=await page.evaluate(()=>({save:JSON.stringify(HPGP.engine.save),storage:JSON.stringify({...localStorage})}));
    await page.locator('#previewButton').click();assert.equal(await page.evaluate(()=>HPGP.engine.state.cutscene.preview),true);
    await tick(4);await snapshot('carry.png');await page.locator('#skipCinema').click();await page.waitForTimeout(60);
    assert.equal(await page.evaluate(()=>HPGP.engine.state.phase),'menu');assert.equal(await page.evaluate(()=>HPGP.engine.state.cutscene),null);
    await page.locator('#settingsButton').click();await page.locator('#previewKissSettings').click();await tick(6);await snapshot('kiss.png');await page.locator('#skipCinema').click();
    const after=await page.evaluate(()=>({save:JSON.stringify(HPGP.engine.save),storage:JSON.stringify({...localStorage})}));
    assert.deepEqual(after,before);return {sameSave:true,sameLocalStorage:true};
  });
  await test('light collision stays in race; third real severe collision enables kiss exactly once each',async()=>{
    await inMenu();await page.evaluate(()=>{HPGP.engine.start({mode:'custom',track:6,carryEnabled:true});HPGP.engine.state.phase='race';HPGP.engine.save.totalCarries=0;HPGP.engine._collision('light','cọc tiêu');});
    assert.equal(await page.evaluate(()=>HPGP.engine.state.phase),'race');assert.equal(await page.evaluate(()=>HPGP.engine.save.totalCarries),0);
    for(let n=1;n<=3;n++){
      const result=await page.evaluate(()=>{const e=HPGP.engine;e._crashCooldown=0;e.state.player.speed=35;e._collision('severe','test barrier');const r={phase:e.state.phase,carries:e.save.totalCarries,kiss:e.state.cutscene?.kiss};e.skipCutscene();r.elapsed=e.state.elapsed;r.penalty=e.state.stats.penalties;return r;});
      assert.equal(result.phase,'cutscene');assert.equal(result.carries,n);assert.equal(result.kiss,n===3);assert.equal(result.penalty,n*8);
    }
    assert.equal(await page.evaluate(()=>HPGP.engine.state.result),null);
    return {carries:3,penaltySeconds:24,note:'severity event injected; spatial obstacle tests are covered by engine suite'};
  });
  await test('a complete real OSM lap finishes by input-only simulation, then result controls work',async()=>{
    const result=await page.evaluate(async()=>{
      const {sampleTrack,angleDiff}=await import('/src/data.js');const e=HPGP.engine;e.start({mode:'custom',track:6,vehicle:0,carryEnabled:false,difficulty:.68});e.state.phase='race';
      for(let i=0;i<120*180 && e.state.phase==='race';i++){
        const p=e.state.player,t=e.state.track,aim=sampleTrack(t,p.progress+Math.max(6,p.speed*.7)),a=sampleTrack(t,p.progress),b=sampleTrack(t,p.progress+30);
        const error=angleDiff(Math.atan2(aim.y-p.y,aim.x-p.x),p.heading),curve=Math.abs(angleDiff(b.heading,a.heading)),target=Math.max(5,Math.min(19,13/(1+curve*1.5)));
        e.update(1/120,{steer:Math.max(-1,Math.min(1,error*3)),throttle:p.speed<target?1:0,brake:p.speed>target+1?.4:0});
      }
      return {phase:e.state.phase,result:e.state.result,stats:e.state.stats,checkpointCount:e.state.checkpoints.length};
    });
    assert.equal(result.phase,'result');assert.equal(result.result.valid,true);assert.equal(result.stats.checkpointsPassed,result.checkpointCount);assert.equal(result.stats.penalties,0);
    await page.waitForFunction(()=>document.querySelector('#resultDialog').open);await snapshot('result.png');
    await page.locator('#resultRestartButton').click();assert.equal(await page.evaluate(()=>HPGP.engine.state.phase),'countdown');
    await page.locator('#pauseButton').click();await page.locator('#menuButton').click();assert.equal(await page.evaluate(()=>HPGP.engine.state.phase),'menu');
    return {time:result.result.time,checkpoints:result.checkpointCount,collisions:result.stats.collisions,note:'test-only feedback driver; no position edits, no rescue'};
  });
  await test('responsive portrait and landscape UI: menu scroll, reachable start and separated HUD/touch',async()=>{
    const cases=[];
    for(const size of [{width:390,height:844},{width:844,height:390},{width:1440,height:1000}]){
      await page.setViewportSize(size);await inMenu();await page.waitForTimeout(50);
      const menu=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,start:!!document.querySelector('#startButton')}));assert.equal(menu.overflow,false);assert.equal(menu.start,true);
      await page.locator('#startButton').click();await tick();await page.waitForTimeout(50);
      const boxes=await page.evaluate(()=>{
        const rect=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
        return {navigation:rect('#navigation'),touch:rect('#touchControls'),hudTop:rect('.hud-top'),minimap:rect('.minimap-panel'),speed:rect('.speed-panel'),viewport:{w:innerWidth,h:innerHeight}};
      });
      const inside=r=>r.left>=-1&&r.right<=size.width+1&&r.top>=-1&&r.bottom<=size.height+1;
      assert.ok(inside(boxes.navigation),'navigation inside viewport');assert.ok(inside(boxes.hudTop),'HUD top inside viewport');
      const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
      assert.equal(overlap(boxes.navigation,boxes.touch),false,'navigation does not overlap touch');assert.equal(overlap(boxes.hudTop,boxes.navigation),false,'top HUD does not overlap navigation');
      await snapshot(`responsive-${size.width}x${size.height}.png`);cases.push({size,boxes});
    }
    return cases;
  });
  await test('emulated mobile pointer controls accelerate without stuck buttons',async()=>{
    const mobile=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});const target=await mobile.newPage();await ready(target);
    await target.locator('#startButton').click();await target.evaluate(()=>{for(let i=0;i<40;i++)HPGP.engine.update(.1,{});});
    await target.waitForTimeout(120);
    const button=target.locator('[data-control="throttle"]');await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box);
    const touch=await target.context().newCDPSession(target);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});await target.waitForTimeout(700);
    const speed=await target.evaluate(()=>HPGP.engine.state.player.speed);assert.ok(speed>1);
    await target.screenshot({path:new URL('mobile-controls.png',preview).pathname});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await target.waitForTimeout(60);assert.equal(await target.evaluate(()=>HPGP.ui.input.throttle),0);await mobile.close();return {speed,device:'Chromium mobile emulation'};
  });
  await test('measured desktop RAF/renderer timing and same-process restart heap samples',async()=>{
    await page.setViewportSize({width:1440,height:1000});await inMenu();await page.evaluate(()=>{HPGP.engine.start({track:0,quality:'high'});HPGP.engine.state.phase='race';});
    const timing=await page.evaluate(async()=>{
      const frames=[];let previous=performance.now();
      await new Promise(resolve=>{let n=0;function sample(now){frames.push(now-previous);previous=now;if(++n>=120)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});
      const sorted=frames.slice(5).sort((a,b)=>a-b);const mean=sorted.reduce((a,b)=>a+b,0)/sorted.length;
      const heap=[];for(let i=0;i<8;i++){HPGP.engine.restart();HPGP.renderer.render(HPGP.engine.state,1/60);heap.push(performance.memory?.usedJSHeapSize??null);}
      return {frames:sorted.length,meanMs:mean,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],estimatedFPS:1000/mean,heapBytes:heap,renderer:HPGP.renderer.stats??null,metrics:HPGP.metrics??null};
    });
    assert.ok(Number.isFinite(timing.meanMs));return timing;
  });
  await test('standard gamepad analog input accelerates and steers without keyboard assistance',async()=>{
    await page.evaluate(()=>{
      HPGP.engine.start({track:0,carryEnabled:false});HPGP.engine.state.phase='race';
      const buttons=Array.from({length:17},()=>({pressed:false,value:0}));buttons[7]={pressed:true,value:1};
      window.__testPad={connected:true,axes:[.45,0],buttons};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__testPad]});
    });
    await page.waitForTimeout(100);
    const before=await page.evaluate(()=>({...HPGP.engine.state.player}));
    await page.waitForTimeout(700);const after=await page.evaluate(()=>({...HPGP.engine.state.player}));
    assert.ok(after.speed>before.speed);assert.ok(Math.abs(after.heading-before.heading)>.01);
    await page.evaluate(()=>{window.__testPad.connected=false;});
    return {speed:after.speed,headingDelta:after.heading-before.heading,note:'standard mapping emulation; physical controllers not available'};
  });
  await test('saved settings/progress reload on the same origin and audio stops on menu',async()=>{
    await inMenu();
    await page.evaluate(()=>{HPGP.engine.setSettings({quality:'low',time:'sunset',weather:'fog',sound:false});});
    const expected=await page.evaluate(()=>({carries:HPGP.engine.save.totalCarries,unlocked:HPGP.engine.save.unlocked,settings:HPGP.engine.save.settings}));
    await ready(page);
    const actual=await page.evaluate(()=>({carries:HPGP.engine.save.totalCarries,unlocked:HPGP.engine.save.unlocked,settings:HPGP.engine.save.settings}));
    assert.deepEqual(actual,expected);
    assert.equal(await page.evaluate(()=>HPGP.audio._active),false);return {sameOrigin:true,restored:actual};
  });
  await test('progress JSON export/import works through visible settings controls',async()=>{
    await inMenu();await page.locator('#settingsButton').click();
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportProgress').click()]);
    const backup=JSON.parse(await readFile(await download.path(),'utf8'));
    assert.equal(backup.format,'hpgp-progress');backup.save.totalCarries+=1;
    await page.locator('#importProgress').setInputFiles({name:'hpgp-progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    await page.waitForFunction(()=>document.querySelector('#progressStatus').textContent.includes('Đã nhập'));
    assert.equal(await page.evaluate(()=>HPGP.engine.save.totalCarries),backup.save.totalCarries);
    assert.ok(await page.evaluate(()=>localStorage.getItem('hpmoto.v8.before-import')));
    await page.locator('#closeSettings').click();return {importedCarries:backup.save.totalCarries,previousBackupPreserved:true};
  });
  await test('restart and route caches remain bounded after garbage collection',async()=>{
    const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.enable');
    await inMenu();await cdp.send('HeapProfiler.collectGarbage');
    const before=(await cdp.send('Runtime.getHeapUsage')).usedSize;
    await page.evaluate(()=>{for(let i=0;i<20;i++){HPGP.engine.start({track:i%10});HPGP.renderer.render(HPGP.engine.state,1/60);HPGP.engine.toMenu();}});
    await page.waitForTimeout(100);await cdp.send('HeapProfiler.collectGarbage');
    const after=(await cdp.send('Runtime.getHeapUsage')).usedSize;
    const cache=await page.evaluate(()=>HPGP.renderer.routeCache.size);
    assert.ok(after-before<15*1024*1024);assert.ok(cache<=10);
    return {beforeBytes:before,afterBytes:after,growthBytes:after-before,cachedRoutes:cache,note:'20 restarts; bounded short stress test, not a long-session leak proof'};
  });
  await test('no uncaught JavaScript errors or missing runtime asset responses',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);return {pageErrors:errors,failedRequests};});
} finally {
  const report={date:new Date().toISOString(),origin,browser:'system Chromium headless / Playwright',tests,errors,failedRequests,summary:{passed:tests.filter(t=>t.status==='passed').length,failed:tests.filter(t=>t.status==='failed').length}};
  await writeFile(new URL('browser-results.json',preview),JSON.stringify(report,null,2));
  await browser.close();
  console.log(JSON.stringify(report.summary));
  if(report.summary.failed)process.exitCode=1;
}

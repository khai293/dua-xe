import {chromium} from 'playwright-core';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const output=new URL('../previews/',import.meta.url);
await mkdir(output,{recursive:true});
const timing=[];
try {
 if(!process.argv.includes('--video-only')) for(const fixture of [{width:1440,height:900,quality:'high'},{width:1440,height:900,quality:'low'},{width:844,height:390,quality:'low',mobile:true}]){
  const context=await browser.newContext({viewport:{width:fixture.width,height:fixture.height},isMobile:!!fixture.mobile,hasTouch:!!fixture.mobile,deviceScaleFactor:1});
  const page=await context.newPage();await page.goto('http://127.0.0.1:4173/?test=1');await page.waitForFunction(()=>!!window.HPGP);
  await page.evaluate(quality=>{HPGP.engine.start({track:0,quality,time:'day',weather:'clear'});HPGP.engine.state.phase='race';},fixture.quality);
  await page.waitForTimeout(300);
  const result=await page.evaluate(async()=>{
   const samples=[];let last=performance.now();
   await new Promise(resolve=>{let n=0;function tick(now){if(n++>5)samples.push(now-last);last=now;if(n>=100)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});
   samples.sort((a,b)=>a-b);const mean=samples.reduce((a,b)=>a+b,0)/samples.length;
   return {samples:samples.length,meanFrameMs:mean,p95Ms:samples[Math.floor(samples.length*.95)],fps:1000/mean,renderMs:HPGP.renderer.stats.frameMs,visibleObjects:HPGP.renderer.stats.visibleObjects};
  });
  timing.push({...fixture,...result});
  if(fixture.mobile){await page.screenshot({path:new URL('mobile-controls.png',output).pathname});}
  await context.close();
 }
 if(timing.length) await writeFile(new URL('performance.json',output),JSON.stringify({environment:'System Chromium headless in cloud container; no physical mobile device or hardware GPU profiler',scenarios:timing},null,2));
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 const page=await context.newPage();await page.goto('http://127.0.0.1:4173/?test=1');await page.waitForFunction(()=>!!window.HPGP);
 const cdp=await context.newCDPSession(page);const frames=[],writes=[];
 const capture=await mkdtemp('/tmp/hpgp-capture-');
 cdp.on('Page.screencastFrame',({data,metadata,sessionId})=>{
  const file=`${capture}/${String(frames.length).padStart(6,'0')}.jpg`;
  frames.push({file,time:metadata.timestamp||Date.now()/1000});
  writes.push(writeFile(file,Buffer.from(data,'base64')));
  void cdp.send('Page.screencastFrameAck',{sessionId}).catch(()=>{});
 });
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:80,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 await page.waitForTimeout(1700);await page.locator('#storyMode').click();await page.locator('#startButton').click();await page.waitForTimeout(1500);await page.locator('#nextStory').click();await page.waitForTimeout(1500);await page.locator('#skipStory').click();
 await page.waitForTimeout(3400);await page.keyboard.down('w');await page.waitForTimeout(1700);await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');await page.keyboard.up('w');await page.keyboard.down('s');await page.waitForTimeout(800);await page.keyboard.up('s');
 await page.locator('#raceSettingsButton').click();await page.locator('#timeSelect').selectOption('night');await page.locator('#weatherSelect').selectOption('rain');await page.locator('#closeSettings').click();await page.waitForTimeout(1300);
 await page.locator('#raceSettingsButton').click();await page.locator('#previewKissSettings').click();await page.waitForTimeout(9300);
 await cdp.send('Page.stopScreencast');await Promise.all(writes);await context.close();
 const listing=['ffconcat version 1.0'];
 for(let i=0;i<frames.length;i++) {listing.push(`file '${frames[i].file}'`);listing.push(`duration ${i+1<frames.length?Math.max(.016,frames[i+1].time-frames[i].time):.05}`);}
 listing.push(`file '${frames.at(-1).file}'`);
 await writeFile(`${capture}/frames.ffconcat`,listing.join('\n')+'\n');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',`${capture}/frames.ffconcat`,'-fps_mode','vfr','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',new URL('gameplay.mp4',output).pathname]);
 await writeFile(new URL('video-capture.json',output),JSON.stringify({frames:frames.length,duration:frames.at(-1).time-frames[0].time,method:'Chromium CDP live screencast, JPEG frame timestamps retained; encoded with installed system ffmpeg'},null,2));
 await rm(capture,{recursive:true,force:true});
 console.log(JSON.stringify(timing));
}finally{await browser.close();}

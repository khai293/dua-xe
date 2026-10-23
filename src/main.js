import {loadData} from './data.js?v=10';
import {GameEngine,SAVE_KEY,LEGACY_SAVE_KEY} from './engine.js?v=10';
import {Renderer} from './renderer.js?v=10';
import {UI} from './ui.js?v=10';
import {AudioSystem} from './audio.js?v=10';
import {exportProgress,importProgress} from './progress.js?v=10';
import {FrameMonitor,AdaptiveResolution} from './performance.js?v=10';
import {CinematicDirector} from './cinematics.js?v=10';

const canvas=document.getElementById('game');
try {
 const data=await loadData();let storage=null,hasSave=false;
 try{storage=window.localStorage;hasSave=Boolean(storage.getItem(SAVE_KEY)||storage.getItem(LEGACY_SAVE_KEY));}catch{}
 const engine=new GameEngine(data,storage);
 if(!hasSave&&((navigator.deviceMemory&&navigator.deviceMemory<=4)||navigator.hardwareConcurrency<=4))engine.save.settings.quality='performance';
 const renderer=new Renderer(canvas,data);await renderer.load();
 const audio=new AudioSystem();audio.setEnabled(engine.save.settings.sound);
 const ui=new UI(engine,data),director=new CinematicDirector(renderer,engine),monitor=new FrameMonitor(),adaptive=new AdaptiveResolution(engine.save.settings.quality);
 ui.onGaragePreview=(index,cosmetics)=>{const c=document.getElementById('garagePreview'),g=c.getContext('2d'),asset=renderer.assets['riders.vehicles'];if(!asset)return;const tile=renderer.cosmeticRider(asset,3,index,cosmetics);g.clearRect(0,0,c.width,c.height);g.drawImage(tile,(c.width-c.height)/2,0,c.height,c.height);};
 ui.setAssets({hero:'./assets/hero.webp',characters:'./assets/characters.webp',rivals:'./assets/rivals.webp',carry:'./assets/carry.webp',kiss:'./assets/kiss.webp'});
 document.getElementById('exportProgress').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([exportProgress(engine.save)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='duong-den-tinh-yeu-v10-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.getElementById('progressStatus').textContent='Đã xuất bản sao tiến trình V10. Giữ file này khi đổi trình duyệt hoặc địa chỉ chơi.';
 });
 document.getElementById('importProgress').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
   if(file.size>250000)throw new Error('File tiến trình quá lớn.');const save=importProgress(await file.text());
   try{storage?.setItem('hpmoto.v9.before-import',exportProgress(engine.save));}catch{}
   engine.save=save;engine.persist();engine.setSettings(save.settings);audio.setEnabled(save.settings.sound);
   engine.toMenu();ui.storyPending=null;ui.settingsAutoPaused=false;ui.showMenu();ui.syncSettings();ui.refreshNames();
   document.getElementById('progressStatus').textContent='Đã nhập tiến trình. Bản trước được giữ trong hpmoto.v9.before-import.';
  }catch(error){document.getElementById('progressStatus').textContent='Không nhập được: '+error.message;}event.target.value='';
 });
 window.addEventListener('endingNavigate',event=>{ui.closeDialogs();engine.toMenu();ui.storyPending=null;ui.showMenu();if(event.detail==='garage'){ui.garageVehicle=ui.vehicle;ui.renderGarage();ui._openDialog('garageDialog');}else{ui.setMode('custom');document.getElementById('routeChoices').scrollIntoView({block:'nearest'});}});
 const pressed=new Set(),reset=()=>{pressed.clear();ui.resetInput();};
 const start=config=>{reset();audio.start();engine.start(config);monitor.reset();};
 ui.bind({start,pause:()=>{reset();engine.pause();audio.stop();},resume:()=>{reset();audio.start();engine.resume();},restart:()=>{reset();audio.start();engine.restart();monitor.reset();},menu:()=>{reset();engine.toMenu();audio.stop();},rescue:()=>{reset();engine.rescue();},
  preview:kiss=>{reset();renderer.render(engine.state,1/60);audio.start();engine.previewCutscene(kiss);},skipCutscene:()=>{reset();engine.skipCutscene();audio.stop();},continueAfterCarry:()=>{reset();engine.continueAfterCarry();audio.stop();},
  previewEnding:()=>{reset();audio.start();engine.previewEnding();},replayEnding:()=>{reset();audio.start();engine.replayEnding();},
  environment:(time,weather)=>engine.setEnvironment(time,weather),camera:()=>{engine.state.cameraMode=(engine.state.cameraMode+1)%3;},sound:enabled=>{audio.setEnabled(enabled);if(enabled)audio.start();},settings:settings=>{engine.setSettings(settings);audio.setEnabled(engine.save.settings.sound);}
 });
 engine.addEventListener('change',event=>{const d=event.detail||{};if(['collision','pickup','carry','finish','skill','ending'].includes(d.type))audio.event(d.type,d.severity);if(d.type==='ending')void renderer.loadEndingAssets();if(['finish','carry','ending'].includes(d.type))reset();});
 const drivingCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight','Space','KeyE']);
 window.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,textarea')||ui.storyPending||document.querySelector('dialog[open]'))return;
  if(drivingCodes.has(event.code)&&['race','countdown'].includes(engine.state.phase)){event.preventDefault();pressed.add(event.code);}if(event.repeat)return;
  if(event.code==='Escape'||event.code==='KeyP'){if(engine.state.phase==='ending')engine.skipEnding();else if(engine.state.phase==='cutscene')ui.actions.skipCutscene();else if(['race','countdown'].includes(engine.state.phase))ui.actions.pause();}
  if(event.code==='KeyC'&&['race','countdown'].includes(engine.state.phase))ui.actions.camera();if(event.code==='KeyR'&&engine.state.phase==='race')ui.actions.rescue();
 });
 window.addEventListener('keyup',event=>pressed.delete(event.code));window.addEventListener('blur',()=>{reset();if(['race','countdown'].includes(engine.state.phase))engine.pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){reset();engine.pause();audio.stop();}});
 const gamepadInput=()=>{const g=navigator.getGamepads?.()?.find(p=>p?.connected);if(!g)return null;const axis=Number(g.axes[0])||0,steer=Math.abs(axis)<.14?0:Math.sign(axis)*(Math.abs(axis)-.14)/.86;return{steer,throttle:Math.max(g.buttons[7]?.value||0,g.buttons[0]?.value||0),brake:Math.max(g.buttons[6]?.value||0,g.buttons[1]?.value||0),tuck:!!g.buttons[4]?.pressed,drift:!!g.buttons[2]?.pressed,nitro:!!g.buttons[5]?.pressed};};
 const metrics={frames:0,frameMs:0,updateMs:0,renderMs:0,fps:0};
 if(new URLSearchParams(location.search).get('test')==='1')window.HPGP={engine,data,renderer,ui,audio,metrics,monitor,adaptive,director};
 let previous=performance.now(),lastHUD=0,lastPerf=0;
 const frame=now=>{
  const frameMs=Math.max(.001,now-previous),dt=Math.min(.1,frameMs/1000);previous=now;
  if(document.hidden){requestAnimationFrame(frame);return;}
  const pad=gamepadInput(),blocked=ui.storyPending||!!document.querySelector('dialog[open]'),keyboardSteer=(pressed.has('KeyD')||pressed.has('ArrowRight')?1:0)-(pressed.has('KeyA')||pressed.has('ArrowLeft')?1:0);
  const input=blocked?{}:{throttle:Math.max(pressed.has('KeyW')||pressed.has('ArrowUp')?1:0,ui.input.throttle,pad?.throttle||0),brake:Math.max(pressed.has('KeyS')||pressed.has('ArrowDown')?1:0,ui.input.brake,pad?.brake||0),steer:Math.max(-1,Math.min(1,keyboardSteer+ui.input.steer+(pad?.steer||0))),tuck:pressed.has('ShiftLeft')||pressed.has('ShiftRight')||ui.input.tuck||pad?.tuck,drift:pressed.has('Space')||ui.input.drift||pad?.drift,nitro:pressed.has('KeyE')||ui.input.nitro||pad?.nitro};
  const began=performance.now();engine.update(dt,input);metrics.updateMs=performance.now()-began;
  if(document.documentElement.dataset.renderPreset!==engine.save.settings.quality)document.documentElement.dataset.renderPreset=engine.save.settings.quality;
  adaptive.setPreset(engine.save.settings.quality);const active=['race','countdown'].includes(engine.state.phase)&&!blocked;
  if(engine.save.settings.autoQuality!==false){adaptive.update(frameMs,active||engine.state.phase==='ending');renderer.dynamicScale=adaptive.scale;renderer.detail=adaptive.detail;}else{renderer.dynamicScale=1;renderer.detail=1;}
  const renderStart=performance.now();if(!director.render(engine.state,dt)&&!['menu','cutscene'].includes(engine.state.phase)&&!ui.storyPending)renderer.render(engine.getRenderState(),dt);metrics.renderMs=performance.now()-renderStart;
  if(now-lastHUD>70||engine.state.phase!==ui.lastPhase){ui.update(engine.state);lastHUD=now;}
  audio.update(engine.state);metrics.frames++;metrics.frameMs=frameMs;
  if(active)monitor.record(frameMs,{physicsMs:Math.max(0,metrics.updateMs-(engine.metrics?.aiMs||0)),aiMs:engine.metrics?.aiMs||0,renderMs:metrics.renderMs,drawCount:renderer.stats.visibleObjects,heapBytes:performance.memory?.usedJSHeapSize});
  if(now-lastPerf>500){const stats=monitor.snapshot();metrics.fps=stats.fps;const hud=document.getElementById('performanceHUD');hud.hidden=!engine.save.settings.showPerformance;if(!hud.hidden)hud.textContent=`${stats.fps.toFixed(1)} FPS · min ${stats.minimumFPS.toFixed(1)} · P95 ${stats.p95FrameMs.toFixed(1)}ms\nVật lý ${stats.physicsMs.toFixed(2)} · AI ${stats.aiMs.toFixed(2)} · Vẽ ${stats.renderMs.toFixed(2)}ms\n${stats.drawCount} đối tượng · ${renderer.canvas.width}×${renderer.canvas.height} px${stats.heapBytes?' · '+(stats.heapBytes/1048576).toFixed(0)+' MB':''}`;lastPerf=now;}
  requestAnimationFrame(frame);
 };
 ui.update(engine.state);requestAnimationFrame(frame);
}catch(error){console.error(error);const loader=document.getElementById('loading');loader.hidden=false;loader.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'Không khởi động được đường đua.'}),Object.assign(document.createElement('p'),{textContent:'Chạy game qua máy chủ web (npm run dev), rồi tải lại trang. '+error.message}));}

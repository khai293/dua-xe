import {loadData} from './data.js';
import {GameEngine} from './engine.js';
import {Renderer} from './renderer.js';
import {UI} from './ui.js';
import {AudioSystem} from './audio.js';
import {exportProgress,importProgress} from './progress.js';

const canvas=document.getElementById('game');
try {
 const data=await loadData();
 let storage=null;let hasSave=false;
 try {storage=window.localStorage;hasSave=Boolean(storage.getItem('hpmoto.v8.save'));}catch{}
 const engine=new GameEngine(data,storage);
 // Recommend a conservative default once; explicit saved choices always win.
 if(!hasSave && ((navigator.deviceMemory&&navigator.deviceMemory<=4)||navigator.hardwareConcurrency<=4)) engine.save.settings.quality='low';
 const renderer=new Renderer(canvas,data);
 await renderer.load();
 const audio=new AudioSystem();audio.setEnabled(engine.save.settings.sound);
 const ui=new UI(engine,data);
 ui.setAssets({hero:'./assets/hero.png',characters:'./assets/characters.png',rivals:'./assets/rivals.png',carry:'./assets/carry.png',kiss:'./assets/kiss.png'});
 document.getElementById('exportProgress').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([exportProgress(engine.save)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='hai-phong-gp-v8-progress.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.getElementById('progressStatus').textContent='Đã xuất bản sao. Giữ file này khi đổi trình duyệt hoặc địa chỉ chạy game.';
 });
 document.getElementById('importProgress').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
   if(file.size>250000)throw new Error('File tiến trình quá lớn.');
   const save=importProgress(await file.text());
   // Import is deliberate; preserve the current backup first for local recovery.
   try {storage?.setItem('hpmoto.v8.before-import',exportProgress(engine.save));}catch{}
   engine.save=save;engine.persist();engine.setSettings(save.settings);audio.setEnabled(save.settings.sound);
   engine.toMenu();ui.storyPending=null;ui.settingsAutoPaused=false;ui.showMenu();ui.syncSettings();
   document.getElementById('progressStatus').textContent='Đã nhập tiến trình. Bản trước được giữ trong hpmoto.v8.before-import.';
  }catch(error){document.getElementById('progressStatus').textContent='Không nhập được: '+error.message;}
  event.target.value='';
 });
 const pressed=new Set();
 const reset=()=>{pressed.clear();ui.resetInput();};
 const start=config=>{reset();audio.start();engine.start(config);};
 ui.bind({start,
  pause:()=>{reset();engine.pause();audio.stop();},
  resume:()=>{reset();audio.start();engine.resume();},
  restart:()=>{reset();audio.start();engine.restart();},
  menu:()=>{reset();engine.toMenu();audio.stop();},
  rescue:()=>{reset();engine.rescue();},
  preview:kiss=>{reset();renderer.render(engine.state,1/60);audio.start();engine.previewCutscene(kiss);},
  skipCutscene:()=>{reset();engine.skipCutscene();audio.stop();},
  continueAfterCarry:()=>{reset();engine.continueAfterCarry();audio.stop();},
  environment:(time,weather)=>engine.setEnvironment(time,weather),
  camera:()=>{engine.state.cameraMode=(engine.state.cameraMode+1)%3;},
  sound:enabled=>{audio.setEnabled(enabled);if(enabled)audio.start();},
  settings:settings=>{engine.setSettings(settings);audio.setEnabled(engine.save.settings.sound);}
 });
 engine.addEventListener('change',e=>{
  const d=e.detail||{};
  if(['collision','pickup','carry','finish','checkpoint'].includes(d.type)) audio.event(d.type,d.severity);
  if(['finish','carry'].includes(d.type))reset();
 });
 const drivingCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight','Space']);
 window.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')||ui.storyPending||document.querySelector('dialog[open]'))return;
  if(drivingCodes.has(e.code)&&['race','countdown'].includes(engine.state.phase)){e.preventDefault();pressed.add(e.code);}
  if(e.repeat)return;
  if(e.code==='Escape'||e.code==='KeyP'){
   if(engine.state.phase==='cutscene')ui.actions.skipCutscene();
   else if(['race','countdown'].includes(engine.state.phase))ui.actions.pause();
  }
  if(e.code==='KeyC'&&['race','countdown'].includes(engine.state.phase))ui.actions.camera();
  if(e.code==='KeyR'&&engine.state.phase==='race')ui.actions.rescue();
 });
 window.addEventListener('keyup',e=>pressed.delete(e.code));
 window.addEventListener('blur',()=>{reset();if(['race','countdown'].includes(engine.state.phase))engine.pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){reset();engine.pause();audio.stop();}});
 const gamepadInput=()=>{
  const g=navigator.getGamepads?.()?.find(p=>p?.connected);
  if(!g)return null;
  const axis=Number(g.axes[0])||0, steer=Math.abs(axis)<.14?0:Math.sign(axis)*(Math.abs(axis)-.14)/.86;
  return {steer,throttle:Math.max(g.buttons[7]?.value||0,g.buttons[0]?.value||0),brake:Math.max(g.buttons[6]?.value||0,g.buttons[1]?.value||0),tuck:!!g.buttons[4]?.pressed};
 };
 const metrics={frames:0,frameMs:0,updateMs:0,renderMs:0,fps:0};
 if(new URLSearchParams(location.search).get('test')==='1')window.HPGP={engine,data,renderer,ui,audio,metrics};
 let previous=performance.now(),lastHUD=0;
 const frame=now=>{
  const dt=Math.min(.1,Math.max(0,(now-previous)/1000));previous=now;
  const pad=gamepadInput(), blocked=ui.storyPending||!!document.querySelector('dialog[open]');
  const keyboardSteer=(pressed.has('KeyD')||pressed.has('ArrowRight')?1:0)-(pressed.has('KeyA')||pressed.has('ArrowLeft')?1:0);
  const input=blocked?{}:{
   throttle:Math.max(pressed.has('KeyW')||pressed.has('ArrowUp')?1:0,ui.input.throttle,pad?.throttle||0),
   brake:Math.max(pressed.has('KeyS')||pressed.has('ArrowDown')||pressed.has('Space')?1:0,ui.input.brake,pad?.brake||0),
   steer:Math.max(-1,Math.min(1,keyboardSteer+ui.input.steer+(pad?.steer||0))),
   tuck:pressed.has('ShiftLeft')||pressed.has('ShiftRight')||ui.input.tuck||pad?.tuck
  };
  const began=performance.now();engine.update(dt,input);metrics.updateMs=performance.now()-began;
  // Menu and cinematics have their own retained artwork. Avoid rendering an obscured world.
  if(!['menu','cutscene'].includes(engine.state.phase)&&!ui.storyPending) renderer.render(engine.state,dt);
  if(now-lastHUD>32||engine.state.phase!==ui.lastPhase){ui.update(engine.state);lastHUD=now;}
  audio.update(engine.state);metrics.frames++;metrics.frameMs=dt*1000;metrics.renderMs=renderer.stats.frameMs;metrics.fps=renderer.stats.fps;
  requestAnimationFrame(frame);
 };
 ui.update(engine.state);requestAnimationFrame(frame);
}catch(error){
 console.error(error);
 const loader=document.getElementById('loading');loader.hidden=false;
 loader.replaceChildren(Object.assign(document.createElement('strong'),{textContent:'Không khởi động được đường đua.'}),Object.assign(document.createElement('p'),{textContent:'Chạy game qua máy chủ web (npm run dev), rồi tải lại trang. '+error.message}));
}

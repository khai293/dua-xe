import {clamp, angleDiff, modulo, sampleTrack, nearestPoint, sampleBranch, nearestBranch} from './data.js?v=10';
import {normalizeProfile,normalizeSettings,sanitizeName,tunedVehicle,upgradeVehicle as buyUpgrade,setCosmetics as changeCosmetics,HEART_BRACELET} from './profile.js?v=10';

export const SAVE_KEY = 'hpmoto.v9.save';
export const LEGACY_SAVE_KEY = 'hpmoto.v8.save';
export const ENDING_DURATION = 46;
const validTimes = ['day', 'sunset', 'night'];
const validWeather = ['clear', 'rain', 'fog'];
const defaultSettings = {quality: 'high', time: 'day', weather: 'clear', sound: true, carryEnabled: true, controlScale: 1, controlOpacity: .7};
const integer = (n, fallback = 0) => Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : fallback;
const readJSON = (storage, key, fallback = null) => {try {return JSON.parse(storage?.getItem(key) || 'null') ?? fallback;} catch {return fallback;}};
const cleanObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Read old saves without modifying or deleting them. Conflicting carry counters are not added. */
function loadLegacySave(storage) {
  const current = readJSON(storage, LEGACY_SAVE_KEY);
  if (current?.version === 8) {
    return {...current, version: 8, unlocked: clamp(integer(current.unlocked, 1), 1, 5),
      wins: cleanObject(current.wins), best: cleanObject(current.best), badges: cleanObject(current.badges),
      totalCarries: integer(current.totalCarries), affection: integer(current.affection), gifts: integer(current.gifts),
      settings: {...defaultSettings, ...cleanObject(current.settings)}};
  }
  const campaign = readJSON(storage, 'hpmoto.campaign.v3', {});
  const legacy = readJSON(storage, 'hp_chibi_gp_v6_save', {});
  const environment = readJSON(storage, 'hpmoto.environment.v5', {});
  let coreCarries = 0;
  try {coreCarries = integer(storage?.getItem('hpmoto.carries.v5'));} catch { /* Storage can be disabled. */ }
  const carries = Math.max(coreCarries, integer(legacy.totalCarries));
  const wins = cleanObject(campaign.wins), best = {...cleanObject(campaign.best)};
  // Keep per-bike V3 and free-race time records accessible, without trusting observer-awarded medals.
  try {
    for (let i = 0; i < (storage?.length || 0); i++) {
      const key = storage.key(i);
      if (/^hpmoto\.(v3\.|free\.v4\.)/.test(key)) {
        const n = Number(storage.getItem(key)); if (Number.isFinite(n) && n > 0) best[key] = n;
      }
    }
  } catch { /* Optional legacy records do not block a race. */ }
  const anyWin = Object.values(wins).some(Boolean);
  return {version: 8, unlocked: clamp(integer(campaign.unlocked, 1), 1, 5), wins, best,
    totalCarries: carries, affection: integer(legacy.affection), gifts: integer(legacy.gifts),
    badges: {first_finish: anyWin, carried_3_times: carries >= 3,
      boss_lucien_clear: Boolean(wins[4] || wins['4']), secret_kiss_scene: false},
    settings: {...defaultSettings,
      time: validTimes.includes(environment.time) ? environment.time : 'day',
      weather: validWeather.includes(environment.weather) ? environment.weather : 'clear',
      carryEnabled: legacy.loveChaosEnabled !== false},
    migration: {from: 'V7', coreCarries, overlayCarries: integer(legacy.totalCarries),
      legacyBadges: cleanObject(legacy.unlockedBadges), note: 'Conflicting V7 counters migrated with max, not sum. Old records remain untouched.'}};
}

export function loadSave(storage){
  const current=readJSON(storage,SAVE_KEY);
  return normalizeProfile(current?.version===9?current:loadLegacySave(storage));
}

function changeEvent(detail) {
  // Native CustomEvent exists in browsers and Node 24; the fallback makes node:test portable.
  if (typeof CustomEvent === 'function') return new CustomEvent('change', {detail});
  const event = new Event('change'); Object.defineProperty(event, 'detail', {value: detail}); return event;
}

function checkpointList(track) {
  const count = Math.max(10, Math.ceil(track.length / 65));
  return Array.from({length: count}, (_, index) => ({...sampleTrack(track, index * track.length / count), index,
    radius: track.halfWidth + 1.5, passed: index === 0}));
}

function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

export class GameEngine extends EventTarget {
  constructor(data, storage = globalThis.localStorage) {
    super(); this.data = data; this.storage = storage; this.save = loadSave(storage);
    this._accumulator = 0; this._crashCooldown = 0; this._contactCooldown = 0; this._savedPreviewState = null; this._returnPhase = null;
    this.state = this._makeState({mode: 'custom', track: 0, level: 0, vehicle: 0, laps: 1, difficulty: .9, opponent: 'lucien', ...this.save.settings});
    this.state.phase = 'menu';
  }

  _emit(type, detail = {}) {this.dispatchEvent(changeEvent({type, ...detail}));}
  persist() {
    try {this.storage?.setItem(SAVE_KEY, JSON.stringify(this.save)); return true;}
    catch {this._emit('toast', {text: 'Trình duyệt không cho lưu. Tiến trình vẫn giữ trong phiên này.'}); return false;}
  }
  setSettings(settings) {
    this.save.settings=normalizeSettings({...this.save.settings,...settings});
    Object.assign(this.state.config,this.save.settings);
    this.state.environment={time:this.save.settings.time,weather:this.save.settings.weather};
    this.persist();this._emit('state');
  }
  setNames(names){
    this.save.characterNames={aurora:sanitizeName(names?.aurora,'Aurora'),lucien:sanitizeName(names?.lucien,'Lucien')};
    this.state.characterNames={...this.save.characterNames};this.persist();this._emit('profile');return this.save.characterNames;
  }
  upgradeVehicle(id,kind){const result=buyUpgrade(this.save,id,kind);if(result.ok){this.state.bike=tunedVehicle(this.data.vehicles[this.state.config.vehicle],this.save);this.persist();this._emit('profile');}return result;}
  setCosmetics(changes){const result=changeCosmetics(this.save,changes);if(result.ok){this.state.cosmetics={...result.cosmetics};this.persist();this._emit('profile');}return result;}
  getRenderState(){
    const s=this.state,a=clamp(this._accumulator*120,0,1),pose=o=>{const p=o.previous;if(!p)return o;return {...o,x:p.x+(o.x-p.x)*a,y:p.y+(o.y-p.y)*a,heading:p.heading+angleDiff(o.heading,p.heading)*a,lean:p.lean+(o.lean-p.lean)*a};};
    return {...s,player:pose(s.player),rivals:s.rivals.map(pose)};
  }
  setEnvironment(time, weather) {
    this.setSettings({time: validTimes.includes(time) ? time : this.state.environment.time,
      weather: validWeather.includes(weather) ? weather : this.state.environment.weather});
  }

  _makeState(config) {
    const track = this.data.tracks[config.track], start = sampleTrack(track, 0, -2.5);
    const player = {...start, id: 'aurora', speed: 0, steer: 0, lean: 0, brake: 0, throttle: 0, tuck: false,
      lap: 1, checkpoint: 0, totalProgress: 0, progress: 0, offRouteTime: 0, wheelRotation: 0, hitTimer: 0, mood: 'focused'};
    Object.assign(player,{nitro:0,nitroActive:false,drifting:false,slip:0,driftTime:0,driftCharge:0,combo:0,comboTimer:0,driftScore:0,weightTransfer:0});
    const state = {phase: 'countdown', config, track, player,
      rivals: [{...sampleTrack(track, 0, 2.5), id: config.opponent || 'lucien', speed: 0, progress: 0, totalProgress: 0, finishTime: null, lean: 0}],
      elapsed: 0, countdown: 3, lap: 1, laps: config.laps, rank: 1, checkpointIndex: 1,
      checkpoints: checkpointList(track), obstacles: [], pickups: [], warning: '', nextTurn: null,
      cutscene: null, result: null, cameraMode: 0, environment: {time: config.time || 'day', weather: config.weather || 'clear'},
      bike:tunedVehicle(this.data.vehicles[config.vehicle]||this.data.vehicles[0],this.save),aiBike:tunedVehicle(this.data.vehicles[config.vehicle]||this.data.vehicles[0],null),characterNames:{...this.save.characterNames},cosmetics:{...this.save.garage.cosmetics},
      ending:null,chase:null,shortcut:null,branches:[],skillMessage:'',
      stats: {skillCoins:0,driftSeconds:0,nitroSeconds:0,shortcuts:0,collisions: 0, lightHits: 0, mediumHits: 0, severeHits: 0, offtrack: 0, pickups: 0, carries: 0, penalties: 0,
        checkpointsPassed: 0, lapsCompleted: 0, distanceDriven: 0}};
    // Designed lane patterns, clear 130m runway and at least one entirely open half-lane.
    const obstacleCount = Math.max(4, Math.min(28, Math.floor(track.length / 145)));
    for (let i = 0; i < obstacleCount; i++) {
      const progress = 145 + i * (track.length - 220) / obstacleCount;
      const turn = track.turns.some(t => Math.abs(t.progress - progress) < 22);
      if (turn) continue; // Never surprise the player at a blind apex.
      const offset = i % 2 ? 3.8 : -3.8, type = ['cone', 'crate', 'cone', 'barrier'][i % 4];
      state.obstacles.push({...sampleTrack(track, progress, offset), id: `hazard-${i}`, type,
        radius: type === 'barrier' ? 1.65 : type === 'crate' ? 1.1 : .7, hit: false, hitAt: -100,
        label: type === 'barrier' ? 'Rào công trình' : type === 'crate' ? 'Thùng hàng' : 'Cọc tiêu'});
    }
    for (let i = 0; i < Math.min(22, Math.floor(track.length / 125)); i++) {
      state.pickups.push({...sampleTrack(track, 95 + i * (track.length - 170) / Math.max(1, Math.floor(track.length / 125)), i % 2 ? -2.5 : 2.5),
        id: `gift-${i}`, type: i % 3 ? 'flower' : 'gift', radius: 1.35, collected: false});
    }
    for(const branch of track.shortcuts||[]){

      let entryDistance=0;
      for(let d=2;d<branch.length*.6;d+=2){const q=sampleBranch(branch,d);if(nearestPoint(track,q.x,q.y,branch.entry).distance>track.halfWidth+.5){entryDistance=d;break;}}
      if(!entryDistance)continue;
      const count=Math.max(3,Math.ceil((branch.length-entryDistance)/22)),gates=[];
      for(let i=0;i<=count;i++)gates.push({...sampleBranch(branch,entryDistance+(branch.length-entryDistance)*i/count),index:i,radius:branch.halfWidth+.5});
      const forkProgress=nearestPoint(track,gates[0].x,gates[0].y,branch.entry).progress;
      const mainIndices=state.checkpoints.filter(cp=>cp.progress>Math.max(branch.entry,forkProgress)+.5&&cp.progress<=branch.exit+1&&cp.index!==0).map(cp=>cp.index);
      if(mainIndices.length)state.branches.push({...branch,mainIndices,gates});
    }
    if(config.mode==='story'){state.player.nitro=config.level===0?38:22;state.storyBeatsShown=[];}
    const intro=config.mode==='story'&&config.level===0;
    if(intro)state.obstacles=state.obstacles.filter((o,i)=>i%3===0&&o.type==='cone');
    return state;
  }

  start(options = {}) {
    const config = {...this.save.settings, mode: 'custom', track: 0, level: 0, vehicle: 0, laps: 1, difficulty: .9, opponent: 'lucien', ...options};
    config.mode = config.mode === 'story' ? 'story' : 'custom';
    config.level = clamp(integer(config.level), 0, 4);
    if (config.mode === 'story') {
      if (config.level >= this.save.unlocked) {this._emit('toast', {text: 'Thắng chặng trước để mở chương này.'}); return false;}
      config.track = config.level; config.laps = 1;
      config.opponent = this.data.levels[config.level].opponent;
      config.difficulty = this.data.levels[config.level].pace;
      config.time=this.data.levels[config.level].time;
    }
    config.track = clamp(integer(config.track), 0, this.data.tracks.length - 1);
    config.vehicle = clamp(integer(config.vehicle), 0, this.data.vehicles.length - 1);
    config.laps = clamp(integer(config.laps, 1), 1, 3);
    config.difficulty = clamp(Number(config.difficulty) || .9, .55, 1.1);
    config.time = validTimes.includes(config.time) ? config.time : 'day';
    config.weather = validWeather.includes(config.weather) ? config.weather : 'clear';
    this.state = this._makeState(config); this._accumulator = 0; this._crashCooldown = 0; this._contactCooldown = 0;
    this._savedPreviewState = null; this._returnPhase = null; this._emit('state'); return true;
  }

  restart() {return this.start({...this.state.config});}
  toMenu() {
    if (this.state.cutscene?.preview && this._savedPreviewState) this.state = this._savedPreviewState;
    this.state.phase = 'menu'; this.state.cutscene = null;this.state.ending=null;this.state.chase=null; this.state.warning = '';
    this._savedPreviewState = null; this._returnPhase = null; this._accumulator = 0; this._emit('state');
  }
  pause() {
    if (!['race', 'countdown'].includes(this.state.phase)) return;
    this._returnPhase = this.state.phase; this.state.phase = 'paused'; this._accumulator = 0; this._emit('state');
  }
  resume() {
    if (this.state.phase !== 'paused') return;
    this.state.phase = this._returnPhase || 'race'; this._returnPhase = null; this._accumulator = 0; this._emit('state');
  }

  update(delta, input = {}) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const s = this.state;
    this.metrics={aiMs:0};
    if(s.phase==='ending'){
      if(!s.ending.complete){s.ending.elapsed=Math.min(ENDING_DURATION,s.ending.elapsed+Math.min(delta,.1));s.ending.stage=endingStage(s.ending.elapsed);s.ending.complete=s.ending.elapsed>=ENDING_DURATION;}return;
    }
    if (s.phase === 'cutscene') {
      s.cutscene.elapsed += Math.min(delta, .1);
      const t = s.cutscene.elapsed;
      s.cutscene.stage = t < 1.4 ? 'approach' : t < 3 ? 'help' : t < 5.5 ? 'carry' : s.cutscene.kiss && t < 8.3 ? 'kiss' : 'leave';
      if (t >= (s.cutscene.kiss ? 10 : 7.6)) this.continueAfterCarry();
      return;
    }
    if (!['race', 'countdown'].includes(s.phase)) return;
    // Gameplay remains 120Hz, independently of rendering and browser throttling.
    this._accumulator += Math.min(delta, .1);
    while (this._accumulator >= 1 / 120) {
      this._accumulator -= 1 / 120;
      if (this.state.phase === 'countdown') {
        this.state.countdown -= 1 / 120;
        if (this.state.countdown <= 0) {this.state.phase = 'race'; this.state.countdown = 0; this._emit('state');}
      } else if (this.state.phase === 'race') this._step(1 / 120, input);
      else {this._accumulator = 0; break;}
    }
  }

  _step(dt, input) {
    const s = this.state, p = s.player, bike = s.bike;
    p.previous={x:p.x,y:p.y,heading:p.heading,lean:p.lean};
    for(const r of s.rivals)r.previous={x:r.x,y:r.y,heading:r.heading,lean:r.lean};
    this._crashCooldown = Math.max(0, this._crashCooldown - dt);
    this._contactCooldown = Math.max(0, this._contactCooldown - dt);
    p.hitTimer = Math.max(0, p.hitTimer - dt); s.elapsed += dt;
    const throttle = clamp(Number(input.throttle) || 0, 0, 1), brake = clamp(Number(input.brake) || 0, 0, 1);
    p.steer += (clamp(Number(input.steer) || 0, -1, 1) - p.steer) * (1 - Math.exp(-9 * dt));
    p.throttle += (throttle-p.throttle)*(1-Math.exp(-6*dt));p.brake=brake;p.tuck=Boolean(input.tuck);
    p.weightTransfer+=(brake*.13-p.throttle*.035-p.weightTransfer)*Math.min(1,dt*9);
    const wetGrip=s.environment.weather==='rain'?.73:1;
    const wasDrifting=p.drifting;
    // A story-only accessible drift: no simultaneous brake required. Steering is still fully manual.
    p.drifting=Boolean(input.drift)&&Math.abs(p.steer)>.2&&p.speed>(s.config.mode==='story'?Math.min(bike.driftMinSpeed,6):bike.driftMinSpeed)&&(s.config.mode==='story'||brake>.08||wasDrifting);
    p.slip+=( (p.drifting?p.steer*.28/(bike.driftGrip*bike.stability):0)-p.slip)*(1-Math.exp(-dt*(p.drifting?4:8)));
    p.comboTimer=Math.max(0,p.comboTimer-dt);if(!p.comboTimer&&!p.drifting)p.combo=0;
    if(p.drifting){p.driftTime+=dt;p.driftCharge+=dt*(8+p.speed*.22);s.stats.driftSeconds+=dt;}
    if(wasDrifting&&!p.drifting){
      if(p.driftTime>.55&&p.hitTimer<=0){p.combo=Math.min(8,p.combo+1);p.comboTimer=4;p.nitro=Math.min(bike.nitroCapacity,p.nitro+p.driftCharge);p.driftScore+=Math.floor(p.driftTime*100*p.combo);const coins=Math.min(25,Math.floor(p.driftTime*3)+2);this.save.coins+=coins;s.stats.skillCoins+=coins;this.persist();this._emit('skill',{text:`Drift x${p.combo} · +${coins} xu`});}
      p.driftTime=p.driftCharge=0;
    }
    p.nitroActive=Boolean(input.nitro)&&p.nitro>.05;
    if(p.nitroActive){p.nitro=Math.max(0,p.nitro-dt*25);s.stats.nitroSeconds+=dt;}
    const drag=.38+p.speed*.012+p.speed*p.speed*.00035+(p.drifting?.7+Math.abs(p.slip)*2:0);
    const acceleration=p.throttle*bike.acc*(p.tuck?1.035:1)+(p.nitroActive?bike.nitroPower:0);
    p.speed=clamp(p.speed+(acceleration-brake*bike.brakePower*wetGrip*(p.drifting?.35:1)-drag)*dt,0,bike.max*(p.nitroActive?1.13:p.tuck?1.025:1));
    const yaw=p.steer*Math.min(p.speed/4,1)*1.42/(1+p.speed/33)*wetGrip*bike.grip*(p.drifting?1.16:1);
    p.heading+=yaw*dt;
    p.lean+=((-p.steer*Math.min(p.speed/35,1)*.65-p.slip*.3)-p.lean)*Math.min(1,dt*8);
    const oldX=p.x,oldY=p.y;
    p.x+=Math.cos(p.heading+p.slip)*p.speed*dt;p.y+=Math.sin(p.heading+p.slip)*p.speed*dt;
    p.wheelRotation+=p.speed*dt/.335;
    let nearest = nearestPoint(s.track, p.x, p.y, p.progress),halfWidth=s.track.halfWidth;
    for(const branch of s.branches){if(s.shortcut?.id!==branch.id&&s.checkpointIndex!==branch.mainIndices[0])continue;
      const n=nearestBranch(branch,p.x,p.y);if(n.distance<nearest.distance){nearest=n;halfWidth=branch.halfWidth;}}

    p.progress = nearest.progress;
    const sideways = Math.sin(angleDiff(p.heading, nearest.heading));
    // Solid race curbs bound the corridor. A glancing scrape slows; a perpendicular high-speed impact is serious.
    if (nearest.distance > halfWidth - .65) {
      const impact = p.speed * Math.abs(sideways);
      const side = Math.sign(nearest.signedDistance) || 1;
      p.x = nearest.x + nearest.nx * side * (halfWidth - .68);
      p.y = nearest.y + nearest.ny * side * (halfWidth - .68);
      p.speed *= Math.exp(-dt * (impact > 12 ? 5 : .8));
      if (this._contactCooldown <= 0 && impact > 3) {
        this._contactCooldown = 1.5;
        this._collision(impact > 23 ? 'severe' : impact > 10 ? 'medium' : 'light', 'rào chắn an toàn');
        if (s.phase !== 'race') return;
      }
    }
    const headingError = Math.abs(angleDiff(p.heading, nearest.heading));
    if (headingError > Math.PI * .58 && p.speed > 1) {
      p.offRouteTime += dt; s.warning = 'SAI HƯỚNG · Giảm tốc và quay lại';
    } else {
      p.offRouteTime = Math.max(0, p.offRouteTime - dt * 2); s.warning = '';
    }
    // Wrong-way warnings never secretly move/steer the player's bike.
    if (p.offRouteTime > 3) s.warning = 'SAI HƯỚNG · Bấm R để cứu hộ về checkpoint';
    this._crossCheckpoint(oldX, oldY, p.x, p.y);
    if (s.phase !== 'race') return;
    p.totalProgress = (p.lap - 1) * s.track.length + p.progress;
    this._storyBeat();
    s.stats.distanceDriven += Math.hypot(p.x - oldX, p.y - oldY);
    this._worldCollisions(oldX, oldY);
    if (s.phase !== 'race') return;
    this._updateAI(dt);this._updateChase(dt);
    for(const r of s.rivals){const gap=r.totalProgress-p.totalProgress,old=r.lastPlayerGap??gap;if(old>0&&gap<=0&&Math.hypot(r.x-p.x,r.y-p.y)<6&&Math.hypot(r.x-p.x,r.y-p.y)>1.5&&!p.hitTimer&&s.elapsed-(r.lastNearPass??-100)>15){r.lastNearPass=s.elapsed;p.nitro=Math.min(bike.nitroCapacity,p.nitro+12);this._emit('skill',{text:'Vượt sát an toàn · +12 Nitro'});}r.lastPlayerGap=gap;}
    s.rank = 1 + s.rivals.filter(r => r.totalProgress > p.totalProgress || r.finishTime !== null).length;
    let turn = null, turnDistance = 180;
    for (const candidate of s.track.turns) {
      const distance = modulo(candidate.progress - p.progress, s.track.length);
      if (distance > 4 && distance < turnDistance) {turn = candidate; turnDistance = distance;}
    }
    if (turn) s.nextTurn = {...turn, distance: modulo(turn.progress - p.progress, s.track.length)};
    else s.nextTurn = {angle: 0, distance: 200, street: s.track.streetNames?.[0] || 'Đường đua'};
    p.mood = p.hitTimer > 0 ? 'surprised' : s.warning ? 'worried' : brake > .2 ? 'focused' : throttle > .7 ? 'happy' : 'focused';
  }

  _crossCheckpoint(ax, ay, bx, by) {
    const s = this.state,p=s.player;
    if(s.shortcut){const branch=s.branches.find(b=>b.id===s.shortcut.id),gate=branch.gates[s.shortcut.nextGate];
      if(crossGate(gate,ax,ay,bx,by)){s.shortcut.nextGate++;
        if(s.shortcut.nextGate>=branch.gates.length){for(const i of branch.mainIndices)s.checkpoints[i].passed=true;s.stats.checkpointsPassed+=branch.mainIndices.length;p.checkpoint=branch.mainIndices.at(-1);s.checkpointIndex=(p.checkpoint+1)%s.checkpoints.length;s.stats.shortcuts++;s.shortcut=null;this._emit('skill',{text:'Qua lối tắt hợp lệ!'});}return true;}return false;
    }
    for(const branch of s.branches)if(s.checkpointIndex===branch.mainIndices[0]&&crossGate(branch.gates[0],ax,ay,bx,by)){s.shortcut={id:branch.id,nextGate:1};return true;}
    const cp = s.checkpoints[s.checkpointIndex];
    const before = (ax - cp.x) * cp.tx + (ay - cp.y) * cp.ty;
    const after = (bx - cp.x) * cp.tx + (by - cp.y) * cp.ty;
    if (before > 0 || after < 0 || after === before) return false;
    const t = -before / (after - before), x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    const lateral = Math.abs((x - cp.x) * cp.nx + (y - cp.y) * cp.ny);
    if (lateral > cp.radius || Math.hypot(bx - ax, by - ay) > 5) return false;
    cp.passed = true; p.checkpoint = cp.index; s.stats.checkpointsPassed++;
    if (s.checkpointIndex === 0) {
      s.stats.lapsCompleted++;
      if (p.lap >= s.laps) {this._finish(); return true;}
      p.lap++; s.lap = p.lap;
      for (const checkpoint of s.checkpoints) checkpoint.passed = checkpoint.index === 0;
      for (const pickup of s.pickups) pickup.collected = false;
      this._emit('toast', {text: `Vòng ${p.lap} / ${s.laps} · Giữ nhịp ga!`});
    }
    s.checkpointIndex = (s.checkpointIndex + 1) % s.checkpoints.length;
    this._emit('checkpoint', {index: cp.index, lap: p.lap}); return true;
  }

  _storyBeat(){
    const s=this.state;if(s.config.mode!=='story'||s.phase!=='race')return;
    const bits=[
      ['Lucien: Anh đang đợi ở phía trước, bình tĩnh nhé ♡','Aurora: Rẽ chuẩn một góc nữa thôi!','Lucien: Sắp tới rồi, em giỏi lắm!'],
      ['Nhi: Có người lén gửi hoa cho cậu đó!','Aurora: Gió hôm nay thơm quá!','Lucien: Đường đẹp nhưng đừng quên nhìn hướng nhé!'],
      ['Phong: Bình tĩnh trước những con phố nhỏ nhé!','Lucien: Anh biết em sẽ tìm được đường mà.','Aurora: Chuyến này nhiều chuyện để kể ghê!'],
      ['Rin: Nhớ để dành chút Nitro đó!','Lucien: Hoàng hôn đẹp thật, phải không?','Aurora: Sắp đến lời hẹn của tụi mình rồi!'],
      ['Lucien: Đua hết mình nhé!','Aurora: Hẹn nhau ở vạch đích!','Lucien: Anh tin em sẽ làm được.']
    ];
    const progress=Math.max(0,Math.min(1,s.player.progress/s.track.length));
    const at=[.12,.46,.78];
    for(let i=0;i<3;i++)if(progress>=at[i]&&!s.storyBeatsShown.includes(i)){
      s.storyBeatsShown.push(i);this._emit('storyBeat',{text:bits[s.config.level][i],index:i,level:s.config.level});
    }
  }

  _worldCollisions(oldX, oldY) {
    const s = this.state, p = s.player;
    for (const obstacle of s.obstacles) {
      if (obstacle.hit && obstacle.type !== 'barrier') continue;
      if (s.elapsed - obstacle.hitAt < 2.5) continue;
      if (segmentDistance(obstacle.x, obstacle.y, oldX, oldY, p.x, p.y) > obstacle.radius + .65) continue;
      obstacle.hit = true; obstacle.hitAt = s.elapsed;
      // Radius matches visible cone/crate/barrier scale; light props cannot start a carry.
      const severity = obstacle.type === 'cone' ? 'light' : obstacle.type === 'crate' ? 'medium' : p.speed > 27 ? 'severe' : 'medium';
      this._collision(severity, obstacle.label);
      if (s.phase !== 'race') return;
    }
    for (const pickup of s.pickups) {
      if (pickup.collected || segmentDistance(pickup.x, pickup.y, oldX, oldY, p.x, p.y) > pickup.radius + .65) continue;
      pickup.collected = true; s.stats.pickups++; this.save.gifts++; this.save.affection += pickup.type === 'flower' ? 1 : 2;
      this.persist(); this._emit('pickup', {pickup});
    }
  }

  _collision(severity, reason) {
    const s = this.state, p = s.player;
    s.stats.collisions++; p.hitTimer = 1.3;
    if (severity === 'light') {s.stats.lightHits++; p.speed *= .86;}
    if (severity === 'medium') {s.stats.mediumHits++; p.speed *= .57;}
    if (severity === 'severe') {s.stats.severeHits++; p.speed *= .18;}
    this._emit('collision', {severity, reason});
    if (severity === 'severe' && this._crashCooldown <= 0 && s.config.carryEnabled !== false) this._beginCarry(reason, false, false);
    else if (severity !== 'light') this._emit('toast', {text: 'Giảm tốc, giữ tay lái — bạn vẫn có thể phục hồi.'});
  }

  _updateAI(dt) {
    const began=performance.now(),s=this.state,bike=s.aiBike,level=s.config.mode==='story'?s.config.level:Math.round((s.config.difficulty-.6)*9);
    for(const r of s.rivals){
      if(r.finishTime!==null){r.speed*=Math.exp(-dt*3);continue;}
      const frame=sampleTrack(s.track,r.progress),ahead=sampleTrack(s.track,r.progress+28),curve=Math.abs(angleDiff(ahead.heading,frame.heading)),wet=s.environment.weather==='rain'?.8:1;
      r.nitro??=0;r.nitroActive=level>=3&&r.nitro>12&&curve<.17&&r.speed>12;r.drifting=level>=1&&curve>.4&&r.speed>bike.driftMinSpeed;
      if(r.drifting)r.nitro=Math.min(bike.nitroCapacity,r.nitro+dt*(level>=3?8:3));if(r.nitroActive)r.nitro=Math.max(0,r.nitro-dt*25);
      let lane=2.1;const hazard=s.obstacles.find(o=>!o.hit&&modulo(o.progress-r.progress,s.track.length)<Math.max(18,r.speed*1.8));
      if(hazard)lane=nearestPoint(s.track,hazard.x,hazard.y,hazard.progress).signedDistance>0?-2.8:2.8;
      if(level>=2&&Math.abs(r.totalProgress-s.player.totalProgress)<15)lane=s.player.steer>0?-3.1:3.1;
      r.lane=(r.lane??2.5)+(lane-(r.lane??2.5))*Math.min(1,dt*2);
      if(!r.branch&&level>=2)for(const branch of s.branches){const gap=branch.entry-r.progress;if(gap>-1&&gap<10){r.branch={id:branch.id,distance:0};break;}}
      const branch=r.branch&&s.branches.find(b=>b.id===r.branch.id),look=Math.max(6,r.speed*.7);
      let aim=sampleTrack(s.track,r.progress+look,r.lane*Math.max(0,1-curve*3));
      if(branch){const nearest=nearestBranch(branch,r.x,r.y);r.branch.distance=nearest.branchProgress;aim=sampleBranch(branch,nearest.branchProgress+look);}
      const error=angleDiff(Math.atan2(aim.y-r.y,aim.x-r.x),r.heading),steer=clamp(error*3,-1,1);
      let target=Math.max(3,Math.min(bike.max*.72*s.config.difficulty*wet*(r.nitroActive?1.13:1),(13+level*1.2)/(1+curve*1.5)));if(Math.abs(error)>.8)target=Math.min(target,2.2);
      r.speed+=clamp(target-r.speed,-bike.brakePower*wet*dt,(bike.acc+(r.nitroActive?bike.nitroPower:0))*dt);
      r.heading+=steer*Math.min(r.speed/4,1)*1.42/(1+r.speed/33)*wet*bike.grip*dt;
      r.x+=Math.cos(r.heading)*r.speed*dt;r.y+=Math.sin(r.heading)*r.speed*dt;r.lean+=(-steer*Math.min(r.speed/35,1)*.65-r.lean)*Math.min(1,dt*8);
      let n=nearestPoint(s.track,r.x,r.y,r.progress);
      if(branch){const local=nearestBranch(branch,r.x,r.y);if(local.branchProgress>branch.length-3&&n.distance<s.track.halfWidth){r.branch=null;n=nearestPoint(s.track,r.x,r.y,branch.exit);}else n=local;}
      let delta=angleProgress(n.progress-r.progress,s.track.length);
      // Only actual movement advances the rival. No catch-up multiplier, snapping or finish teleport.
      if(Math.abs(delta)>Math.max(branch?30:5,r.speed*dt*5))delta=0;
      r.totalProgress=Math.max(0,r.totalProgress+delta);r.progress=modulo(r.progress+delta,s.track.length);
      if(r.totalProgress>=s.track.length*s.laps)r.finishTime=s.elapsed;
    }
    if(this.metrics)this.metrics.aiMs+=performance.now()-began;
  }
  _updateChase(dt){
    const s=this.state,p=s.player;
    if(s.config.mode!=='story'||s.config.level===4||s.phase!=='race'||s.config.carryEnabled===false)return;
    if(!s.chase&&s.elapsed>80&&(s.config.level>0)&&!s.chaseAttempted){s.chaseAttempted=true;const q=sampleTrack(s.track,p.progress-28,-2.5);s.chase={...q,id:'lucien',active:true,speed:Math.max(10,p.speed),totalProgress:p.totalProgress-28,elapsed:0};this._emit('chase',{text:'Hahaha! Có giỏi thì đuổi kịp em nhé!'});}
    const c=s.chase;if(!c?.active)return;c.elapsed+=dt;
    const target=Math.min(s.bike.max*.84,p.speed+5);c.speed+=clamp(target-c.speed,-s.bike.brakePower*dt,s.bike.acc*dt);c.totalProgress+=c.speed*dt;
    const q=sampleTrack(s.track,c.totalProgress,-2.5);Object.assign(c,{x:q.x,y:q.y,heading:q.heading,progress:q.progress});
    if(c.elapsed>2&&Math.hypot(c.x-p.x,c.y-p.y)<2.4){c.active=false;this._beginCarry('Lucien đuổi kịp rồi! Hahaha!',false,false);}
    else if(c.elapsed>14||p.totalProgress-c.totalProgress>80){c.active=false;p.nitro=Math.min(s.bike.nitroCapacity,p.nitro+10);this._emit('skill',{text:'Thoát rồi! Lần sau anh cố hơn nhé ♡'});}
  }

  _finish() {
    const s = this.state;
    // Result validity is derived from physical ordered crossings, never a UI observer or distance counter.
    if(s.result?.valid)return false;
    const expected = s.checkpoints.length * s.laps;
    if (s.stats.checkpointsPassed !== expected || s.stats.lapsCompleted !== s.laps) return false;
    const position = 1 + s.rivals.filter(r => r.finishTime !== null).length, won = position === 1;
    const key = `${s.config.mode}.${s.config.track}.${s.config.laps}.${s.config.vehicle}`;
    const previous = Number(this.save.best[key]);
    const best = !Number.isFinite(previous) || s.elapsed < previous;
    if (best) this.save.best[key] = s.elapsed;
    this.save.badges.first_finish = true;
    if (won && !s.stats.offtrack && !s.stats.carries) this.save.badges.no_lost_win = true;
    if (won && s.config.mode === 'story') {
      this.save.wins[s.config.level] = true;
      this.save.unlocked = Math.max(this.save.unlocked, Math.min(5, s.config.level + 2));
      if (s.config.level === 4) this.save.badges.boss_lucien_clear = true;
    }
    this.save.affection += won ? 5 : 2;
    s.result = {valid: true, won, time: s.elapsed, position, best, previous: Number.isFinite(previous) ? previous : null,
      carried: s.stats.carries, medal: won ? 'gold' : 'silver', track: s.track.name, stats: {...s.stats}};
    const coins=won?350+(s.config.mode==='story'?s.config.level*60:0):120;this.save.coins+=coins;s.result.coins=coins;
    s.phase='result';s.player.speed=0;s.chase=null;
    if(won&&s.config.mode==='story'&&s.config.level===4){
      if(!this.save.endingUnlocked){this.save.endingUnlocked=true;this.save.memories.heart_bracelet={...HEART_BRACELET,receivedAt:new Date().toISOString(),names:{...this.save.characterNames}};}
      this._beginEnding(false,false);
    }
    this.persist();this._emit('finish',{result:s.result});this._emit('state');return true;
  }

  _beginCarry(reason, preview, forceKiss) {
    if (this.state.phase === 'cutscene') return false;
    const s = this.state;
    if (!preview && (s.phase !== 'race' || this._crashCooldown > 0)) return false;
    if (!preview) {
      this.save.totalCarries++; s.stats.carries++; this.save.affection++;
      if (this.save.totalCarries >= 3) this.save.badges.carried_3_times = true;
    }
    const kiss = preview ? Boolean(forceKiss) : this.save.totalCarries % 3 === 0;
    if (!preview && kiss) this.save.badges.secret_kiss_scene = true;
    s.cutscene = {elapsed: 0, preview, kiss, reason, stage: 'approach', variant: preview ? 0 : this.save.totalCarries % 3,
      totalCarries: this.save.totalCarries, x: s.player.x, y: s.player.y, heading: s.player.heading};
    s.phase = 'cutscene'; s.player.speed = 0; this._accumulator = 0;
    if (!preview) this.persist(); this._emit('carry', {preview, kiss, reason}); this._emit('state'); return true;
  }

  previewCutscene(kiss = false) {
    if (this.state.phase === 'cutscene') return false;
    this._savedPreviewState = this.state;
    this.state = this._makeState({...this.state.config});
    this.state.phase = 'menu';
    return this._beginCarry('Un instant à deux', true, kiss);
  }

  continueAfterCarry() {
    const scene = this.state.cutscene;
    if (!scene) return false;
    if (scene.preview) {
      this.state = this._savedPreviewState || this.state; this._savedPreviewState = null;
      this.state.cutscene = null;
      this._accumulator = 0; this._emit('state'); return true;
    }
    this.state.cutscene = null;
    this._recover(8, true);
    this._crashCooldown = 12; this.state.phase = 'race'; this.state.cameraMode = 0;
    this._accumulator = 0; this._emit('state'); return true;
  }
  skipCutscene() {return this.continueAfterCarry();}

  _recover(penalty, carry = false) {
    const s = this.state, p = s.player, cp = s.checkpoints[p.checkpoint || 0];s.shortcut=null;s.chase=null;
    // Put the bike just after its last VALID gate; do not advance the pending gate.
    const point = sampleTrack(s.track, cp.progress + 2, -2.5);
    Object.assign(p, {x: point.x, y: point.y, heading: point.heading, progress: point.progress,
      speed: 0, steer: 0, lean: 0, slip:0,drifting:false,nitroActive:false, offRouteTime: 0, hitTimer: 3, mood: carry ? 'shy' : 'focused'});
    s.elapsed += penalty; s.stats.penalties += penalty; s.warning = '';
    for (let i = 0; i < Math.ceil(penalty * 30); i++) this._updateAI(1 / 30);
    this._emit('toast', {text: `Trở lại checkpoint ${cp.index + 1} · +${penalty} giây${carry ? ' · Hahaha! ♡' : ''}`});
  }
  _beginEnding(preview,replay){this.state.ending={elapsed:0,stage:'victory',complete:false,preview,replay};this.state.phase='ending';this.state.chase=null;this._accumulator=0;this._emit('ending');}
  previewEnding(){if(['ending','cutscene'].includes(this.state.phase))return false;this._endingReturnState=this.state;this.state=this._makeState({...this.state.config,time:'night'});this._beginEnding(true,false);return true;}
  replayEnding(){if(!this.save.endingUnlocked||this.state.phase==='ending')return false;this._endingReturnState=this.state;this.state=this._makeState({...this.state.config,time:'night'});this._beginEnding(false,true);return true;}
  skipEnding(){if(this.state.phase!=='ending')return false;Object.assign(this.state.ending,{elapsed:ENDING_DURATION,stage:'memories',complete:true});this._emit('state');return true;}
  finishEnding(){if(this.state.phase!=='ending')return false;const e=this.state.ending;if(e.preview||e.replay){this.state=this._endingReturnState||this.state;this._endingReturnState=null;}else{this.state.phase='result';this.state.ending=null;}this._emit('state');return true;}
  rescue() {
    if (!['race', 'paused'].includes(this.state.phase)) return false;
    this._recover(5); this._crashCooldown = Math.max(4, this._crashCooldown); this._contactCooldown = 2;
    this.state.stats.offtrack++; this._emit('state'); return true;
  }
}

export function endingStage(t){return t<5?'victory':t<12?'congratulate':t<22?'gift':t<34?'ride':t<40?'restaurant':t<46?'dinner':'memories';}
function crossGate(cp,ax,ay,bx,by){if(!cp||Math.hypot(bx-ax,by-ay)>5)return false;const before=(ax-cp.x)*cp.tx+(ay-cp.y)*cp.ty,after=(bx-cp.x)*cp.tx+(by-cp.y)*cp.ty;if(before>0||after<0||before===after)return false;const t=-before/(after-before),x=ax+(bx-ax)*t,y=ay+(by-ay)*t;return Math.abs((x-cp.x)*cp.nx+(y-cp.y)*cp.ny)<=cp.radius;}

function angleProgress(delta,length){return modulo(delta+length/2,length)-length/2;}

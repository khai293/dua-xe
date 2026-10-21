import {clamp, angleDiff, modulo, sampleTrack, nearestPoint} from './data.js';

export const SAVE_KEY = 'hpmoto.v8.save';
const validTimes = ['day', 'sunset', 'night'];
const validWeather = ['clear', 'rain', 'fog'];
const defaultSettings = {quality: 'high', time: 'day', weather: 'clear', sound: true, carryEnabled: true, controlScale: 1, controlOpacity: .7};
const integer = (n, fallback = 0) => Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : fallback;
const readJSON = (storage, key, fallback = null) => {try {return JSON.parse(storage?.getItem(key) || 'null') ?? fallback;} catch {return fallback;}};
const cleanObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Read old saves without modifying or deleting them. Conflicting carry counters are not added. */
export function loadSave(storage) {
  const current = readJSON(storage, SAVE_KEY);
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
    const allowed = {...this.save.settings};
    if (['low', 'high', 'ultra'].includes(settings.quality)) allowed.quality = settings.quality;
    if (validTimes.includes(settings.time)) allowed.time = settings.time;
    if (validWeather.includes(settings.weather)) allowed.weather = settings.weather;
    for (const key of ['sound', 'carryEnabled']) if (typeof settings[key] === 'boolean') allowed[key] = settings[key];
    if (Number.isFinite(Number(settings.controlScale))) allowed.controlScale = clamp(Number(settings.controlScale), .75, 1.4);
    if (Number.isFinite(Number(settings.controlOpacity))) allowed.controlOpacity = clamp(Number(settings.controlOpacity), .25, 1);
    this.save.settings = allowed; Object.assign(this.state.config, allowed);
    this.state.environment = {time: allowed.time, weather: allowed.weather};
    this.persist(); this._emit('state');
  }
  setEnvironment(time, weather) {
    this.setSettings({time: validTimes.includes(time) ? time : this.state.environment.time,
      weather: validWeather.includes(weather) ? weather : this.state.environment.weather});
  }

  _makeState(config) {
    const track = this.data.tracks[config.track], start = sampleTrack(track, 0, -2.5);
    const player = {...start, id: 'aurora', speed: 0, steer: 0, lean: 0, brake: 0, throttle: 0, tuck: false,
      lap: 1, checkpoint: 0, totalProgress: 0, progress: 0, offRouteTime: 0, wheelRotation: 0, hitTimer: 0, mood: 'focused'};
    const state = {phase: 'countdown', config, track, player,
      rivals: [{...sampleTrack(track, 0, 2.5), id: config.opponent || 'lucien', speed: 0, progress: 0, totalProgress: 0, finishTime: null, lean: 0}],
      elapsed: 0, countdown: 3, lap: 1, laps: config.laps, rank: 1, checkpointIndex: 1,
      checkpoints: checkpointList(track), obstacles: [], pickups: [], warning: '', nextTurn: null,
      cutscene: null, result: null, cameraMode: 0, environment: {time: config.time || 'day', weather: config.weather || 'clear'},
      stats: {collisions: 0, lightHits: 0, mediumHits: 0, severeHits: 0, offtrack: 0, pickups: 0, carries: 0, penalties: 0,
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
    this.state.phase = 'menu'; this.state.cutscene = null; this.state.warning = '';
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
    const s = this.state, p = s.player, bike = this.data.vehicles[s.config.vehicle];
    this._crashCooldown = Math.max(0, this._crashCooldown - dt);
    this._contactCooldown = Math.max(0, this._contactCooldown - dt);
    p.hitTimer = Math.max(0, p.hitTimer - dt); s.elapsed += dt;
    const throttle = clamp(Number(input.throttle) || 0, 0, 1), brake = clamp(Number(input.brake) || 0, 0, 1);
    p.steer += (clamp(Number(input.steer) || 0, -1, 1) - p.steer) * (1 - Math.exp(-9 * dt));
    p.throttle = throttle; p.brake = brake; p.tuck = Boolean(input.tuck);
    const wetGrip = s.environment.weather === 'rain' ? .73 : 1;
    const drag = .38 + p.speed * .012 + p.speed * p.speed * .00035;
    p.speed = clamp(p.speed + (throttle * bike.acc * (p.tuck ? 1.035 : 1) - brake * 15.5 * wetGrip - drag) * dt, 0, bike.max * (p.tuck ? 1.025 : 1));
    const yaw = p.steer * Math.min(p.speed / 4, 1) * 1.42 / (1 + p.speed / 33) * wetGrip * bike.grip;
    p.heading += yaw * dt;
    p.lean += ((-p.steer * Math.min(p.speed / 35, 1) * .65) - p.lean) * Math.min(1, dt * 8);
    const oldX = p.x, oldY = p.y;
    p.x += Math.cos(p.heading) * p.speed * dt;
    p.y += Math.sin(p.heading) * p.speed * dt;
    p.wheelRotation += p.speed * dt / .335;
    const nearest = nearestPoint(s.track, p.x, p.y, p.progress);
    p.progress = nearest.progress;
    const sideways = Math.sin(angleDiff(p.heading, nearest.heading));
    // Solid race curbs bound the corridor. A glancing scrape slows; a perpendicular high-speed impact is serious.
    if (nearest.distance > s.track.halfWidth - .65) {
      const impact = p.speed * Math.abs(sideways);
      const side = Math.sign(nearest.signedDistance) || 1;
      p.x = nearest.x + nearest.nx * side * (s.track.halfWidth - .68);
      p.y = nearest.y + nearest.ny * side * (s.track.halfWidth - .68);
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
    s.stats.distanceDriven += Math.hypot(p.x - oldX, p.y - oldY);
    this._worldCollisions(oldX, oldY);
    if (s.phase !== 'race') return;
    this._updateAI(dt);
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
    const s = this.state, p = s.player, cp = s.checkpoints[s.checkpointIndex];
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
    const s = this.state, max = this.data.vehicles[s.config.vehicle].max;
    for (const rival of s.rivals) {
      if (rival.finishTime !== null) {rival.speed *= Math.exp(-dt * 3); continue;}
      const frame = sampleTrack(s.track, rival.progress);
      const ahead = sampleTrack(s.track, rival.progress + 25);
      const curve = Math.abs(angleDiff(ahead.heading, frame.heading));
      const grip = s.environment.weather === 'rain' ? .82 : 1;
      const targetSpeed = Math.max(8, Math.min(max * .72 * s.config.difficulty * grip, 23 / (1 + curve * 2.8)));
      rival.speed += clamp(targetSpeed - rival.speed, -14 * dt, 6 * dt);
      rival.totalProgress += rival.speed * dt; rival.progress = modulo(rival.totalProgress, s.track.length);
      const point = sampleTrack(s.track, rival.progress, 2.3);
      Object.assign(rival, {x: point.x, y: point.y, heading: point.heading, lean: -angleDiff(ahead.heading, frame.heading) * .45});
      if (rival.totalProgress >= s.track.length * s.laps) rival.finishTime = s.elapsed;
    }
  }

  _finish() {
    const s = this.state;
    // Result validity is derived from physical ordered crossings, never a UI observer or distance counter.
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
    s.phase = 'result'; s.player.speed = 0; this.persist(); this._emit('finish', {result: s.result}); this._emit('state'); return true;
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
    const s = this.state, p = s.player, cp = s.checkpoints[p.checkpoint || 0];
    // Put the bike just after its last VALID gate; do not advance the pending gate.
    const point = sampleTrack(s.track, cp.progress + 2, -2.5);
    Object.assign(p, {x: point.x, y: point.y, heading: point.heading, progress: point.progress,
      speed: 0, steer: 0, lean: 0, offRouteTime: 0, hitTimer: 3, mood: carry ? 'shy' : 'focused'});
    s.elapsed += penalty; s.stats.penalties += penalty; s.warning = '';
    for (let i = 0; i < Math.ceil(penalty * 30); i++) this._updateAI(1 / 30);
    this._emit('toast', {text: `Trở lại checkpoint ${cp.index + 1} · +${penalty} giây${carry ? ' · Hahaha! ♡' : ''}`});
  }
  rescue() {
    if (!['race', 'paused'].includes(this.state.phase)) return false;
    this._recover(5); this._crashCooldown = Math.max(4, this._crashCooldown); this._contactCooldown = 2;
    this.state.stats.offtrack++; this._emit('state'); return true;
  }
}

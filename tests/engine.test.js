import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createData, prepareTrack, sampleTrack, angleDiff} from '../src/data.js';
import {GameEngine, loadSave, SAVE_KEY} from '../src/engine.js';

class MemoryStorage {
  constructor(initial = {}) {this.map = new Map(Object.entries(initial));}
  getItem(k) {return this.map.has(k) ? this.map.get(k) : null;}
  setItem(k, v) {this.map.set(k, String(v));}
  get length() {return this.map.size;}
  key(i) {return [...this.map.keys()][i] || null;}
}
const geo = JSON.parse(await readFile(new URL('../assets/haiphong-osm.json', import.meta.url), 'utf8'));
const data = createData(geo);
const fresh = (initial = {}, inputData = data) => new GameEngine(inputData, new MemoryStorage(initial));
const startRace = (engine, options = {}) => {assert.equal(engine.start(options), true);engine.state.phase = 'race';engine.state.obstacles = [];engine.state.pickups = [];};
const run = (engine, seconds, input) => {for (let i = 0; i < seconds * 120; i++) engine.update(1 / 120, input);};
function passGate(engine, index) {
  const cp = engine.state.checkpoints[index];
  engine._crossCheckpoint(cp.x - cp.tx * .3, cp.y - cp.ty * .3, cp.x + cp.tx * .3, cp.y + cp.ty * .3);
}

test('original V7 content is retained: 5 story chapters, 10 independent OSM routes, four bikes', () => {
  assert.equal(data.tracks.length, 10); assert.equal(data.levels.length, 5); assert.equal(data.story.length, 5); assert.equal(data.vehicles.length, 4);
  assert.equal(data.levels[4].opponent, 'lucien');
  for (const track of data.tracks) {
    assert.ok(track.length > 600); assert.equal(track.rawPoints.length, geo.routes[track.index].points.length);
    for (let i = 0; i < track.points.length; i++) {
      const a = track.points[i], b = track.points[(i + 1) % track.points.length];
      assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) <= 4.001, `${track.name}: continuous road`);
    }
  }
});

test('all 10 custom maps and all unlocked five story chapters initialize valid physical gates', () => {
  const engine = fresh({'hpmoto.campaign.v3': JSON.stringify({unlocked: 5})});
  for (let track = 0; track < 10; track++) {
    assert.equal(engine.start({mode: 'custom', track}), true);
    assert.equal(engine.state.track.index, track); assert.ok(engine.state.obstacles.length >= 1);
    assert.ok(engine.state.checkpoints.length >= 10); assert.ok(Number.isFinite(engine.state.player.heading));
  }
  for (let level = 0; level < 5; level++) {
    assert.equal(engine.start({mode: 'story', level}), true); assert.equal(engine.state.config.track, level);
  }
});

test('locked story chapters cannot be started through configuration', () => {
  const engine = fresh(); assert.equal(engine.start({mode: 'story', level: 1}), false); assert.equal(engine.save.unlocked, 1);
});

test('migration reconciles carries using max, retains campaign and does not duplicate counters', () => {
  const storage = new MemoryStorage({'hpmoto.carries.v5': '2', 'hp_chibi_gp_v6_save': JSON.stringify({totalCarries: 4, gifts: 7, unlockedBadges: {boss_lucien_clear: true}}),
    'hpmoto.campaign.v3': JSON.stringify({unlocked: 3, wins: {0: true}, best: {0: 42}})});
  const save = loadSave(storage);
  assert.equal(save.totalCarries, 4); assert.equal(save.gifts, 7); assert.equal(save.unlocked, 3); assert.equal(save.best[0], 42);
  assert.equal(save.badges.boss_lucien_clear, false); assert.equal(storage.getItem('hpmoto.carries.v5'), '2');
});

test('corrupted saves fall back safely, and current V9 saves round-trip', () => {
  const engine = fresh({[SAVE_KEY]: '{bad json'}); assert.equal(engine.save.unlocked, 1);
  engine.setSettings({quality: 'low', controlOpacity: .5}); engine.save.totalCarries = 6; engine.persist();
  const restored = new GameEngine(data, engine.storage); assert.equal(restored.save.totalCarries, 6); assert.equal(restored.save.settings.quality, 'performance');
});

test('preview carry/kiss never changes counters, badges, progress, gifts or persistence', () => {
  const engine = fresh(); const saveBefore = JSON.stringify(engine.save), storageBefore = [...engine.storage.map];
  const originalState = engine.state;
  for (let i = 0; i < 4; i++) {
    engine.previewCutscene(i % 2 === 0); assert.equal(engine.state.phase, 'cutscene'); assert.equal(engine.state.cutscene.preview, true);
    engine.update(1, {}); engine.skipCutscene(); assert.equal(engine.state, originalState); assert.equal(engine.state.phase, 'menu');
  }
  assert.equal(JSON.stringify(engine.save), saveBefore); assert.deepEqual([...engine.storage.map], storageBefore);
});

test('preview during a race restores the exact pre-preview race without advancing time', () => {
  const engine = fresh(); startRace(engine); run(engine, 1, {throttle: 1});
  const state = engine.state, position = [state.player.x, state.player.y], time = state.elapsed;
  engine.previewCutscene(); engine.skipCutscene();
  assert.equal(engine.state, state); assert.deepEqual([state.player.x, state.player.y], position); assert.equal(state.elapsed, time); assert.equal(state.phase, 'race');
});

test('only severe collisions trigger a carry; each third actual carry enables kiss once', () => {
  const engine = fresh(); startRace(engine);
  engine.state.player.speed = 30; engine._collision('light', 'Cọc tiêu'); assert.equal(engine.state.phase, 'race'); assert.equal(engine.save.totalCarries, 0);
  engine._collision('medium', 'Thùng hàng'); assert.equal(engine.state.phase, 'race'); assert.equal(engine.save.totalCarries, 0);
  for (let count = 1; count <= 3; count++) {
    engine._crashCooldown = 0; engine.state.player.speed = 45; engine._collision('severe', 'Rào');
    assert.equal(engine.state.phase, 'cutscene'); assert.equal(engine.save.totalCarries, count);
    assert.equal(engine.state.cutscene.kiss, count % 3 === 0);
    assert.equal(engine._beginCarry('duplicate', false, false), false);
    engine.skipCutscene(); assert.equal(engine.state.phase, 'race'); assert.equal(engine.state.cutscene, null); assert.equal(engine.state.cameraMode, 0);
  }
  assert.equal(engine.save.badges.secret_kiss_scene, true); assert.equal(engine.save.badges.first_finish, false);
  assert.equal(engine.state.result, null); assert.equal(engine.save.unlocked, 1);
});

test('cutscene skip clears gameplay state and applies one checkpoint recovery penalty', () => {
  const engine = fresh(); startRace(engine); engine.state.elapsed = 12;
  engine._beginCarry('test crash', false, false); engine.state.cameraMode = 2; engine.skipCutscene();
  assert.equal(engine.state.elapsed, 20); assert.equal(engine.state.cutscene, null); assert.equal(engine.state.player.speed, 0);
  assert.equal(engine.skipCutscene(), false); assert.equal(engine.state.elapsed, 20); assert.equal(engine._crashCooldown, 12);
  assert.equal(engine._beginCarry('cooldown', false, false), false);
});

test('cutscene completes naturally through its state machine', () => {
  const engine = fresh(); startRace(engine); engine._beginCarry('test', false, false);
  for (let i = 0; i < 100; i++) engine.update(.1);
  assert.equal(engine.state.phase, 'race'); assert.equal(engine.state.cutscene, null); assert.equal(engine.save.totalCarries, 1);
});

test('progress/distance alone cannot finish or grant medals', () => {
  const engine = fresh(); startRace(engine);
  engine.state.player.progress = engine.state.track.length; engine.state.player.totalProgress = 999999;
  assert.equal(engine._finish(), false); assert.equal(engine.state.result, null); assert.equal(engine.save.badges.first_finish, false);
  passGate(engine, 0); assert.equal(engine.state.checkpointIndex, 1); assert.equal(engine.state.stats.checkpointsPassed, 0);
});

test('checkpoints reject wrong order, wrong direction, bypassed width and teleport crossings', () => {
  const engine = fresh(); startRace(engine); const cp = engine.state.checkpoints[1];
  passGate(engine, 2); assert.equal(engine.state.checkpointIndex, 1);
  engine._crossCheckpoint(cp.x + cp.tx, cp.y + cp.ty, cp.x - cp.tx, cp.y - cp.ty);
  assert.equal(engine.state.checkpointIndex, 1);
  engine._crossCheckpoint(cp.x - cp.tx + cp.nx * 20, cp.y - cp.ty + cp.ny * 20, cp.x + cp.tx + cp.nx * 20, cp.y + cp.ty + cp.ny * 20);
  assert.equal(engine.state.checkpointIndex, 1);
  engine._crossCheckpoint(cp.x - cp.tx * 20, cp.y - cp.ty * 20, cp.x + cp.tx * 20, cp.y + cp.ty * 20);
  assert.equal(engine.state.checkpointIndex, 1);
  passGate(engine, 1); assert.equal(engine.state.checkpointIndex, 2);
});

test('ordered physical gate crossings complete a lap, grant one result and persist progression', () => {
  const engine = fresh(); startRace(engine, {mode: 'story', level: 0}); engine.state.elapsed = 100;
  const count = engine.state.checkpoints.length;
  for (let index = 1; index < count; index++) passGate(engine, index);
  passGate(engine, 0);
  assert.equal(engine.state.phase, 'result'); assert.equal(engine.state.result.valid, true); assert.equal(engine.state.result.won, true);
  assert.equal(engine.save.unlocked, 2); assert.equal(engine.save.wins[0], true); assert.equal(engine.save.badges.first_finish, true);
  assert.equal(engine.state.stats.checkpointsPassed, count); assert.equal(engine.state.stats.lapsCompleted, 1);
  assert.equal(new GameEngine(data, engine.storage).save.unlocked, 2);
});

test('two laps require two whole ordered checkpoint sequences', () => {
  const engine = fresh(); startRace(engine, {laps: 2});
  const count = engine.state.checkpoints.length;
  for (let lap = 0; lap < 2; lap++) {
    for (let index = 1; index < count; index++) passGate(engine, index);
    passGate(engine, 0); assert.equal(engine.state.phase, lap === 0 ? 'race' : 'result');
  }
  assert.equal(engine.state.stats.checkpointsPassed, count * 2);
});

test('rescue returns to last valid checkpoint without skipping the next one', () => {
  const engine = fresh(); startRace(engine); passGate(engine, 1); passGate(engine, 2);
  const pending = engine.state.checkpointIndex; engine.state.player.x += 100; engine.state.player.y += 100;
  assert.equal(engine.rescue(), true); assert.equal(engine.state.checkpointIndex, pending);
  assert.equal(engine.state.player.checkpoint, 2); assert.equal(engine.state.elapsed, 5); assert.equal(engine.state.player.speed, 0);
});

test('pickups require spatial overlap, not elapsed time or progress', () => {
  const engine = fresh(); startRace(engine); const p = engine.state.player;
  const gift = {id:'spatial',x:p.x + 5,y:p.y,radius:1,collected:false,type:'gift'}; engine.state.pickups = [gift];
  engine.state.player.progress += 1000; engine._worldCollisions(p.x, p.y);
  assert.equal(gift.collected, false); assert.equal(engine.save.gifts, 0);
  gift.x = p.x; gift.y = p.y; engine._worldCollisions(p.x, p.y);
  assert.equal(gift.collected, true); assert.equal(engine.save.gifts, 1);
  engine._worldCollisions(p.x,p.y); assert.equal(engine.save.gifts, 1);
});

test('a swept path detects a real obstacle and no collision occurs in the opposite lane', () => {
  const engine = fresh(); startRace(engine); const p = engine.state.player;
  engine.state.obstacles = [{id:'cone',x:p.x + 10,y:p.y,radius:.7,type:'cone',hit:false,hitAt:-100}];
  p.speed = 20; engine._worldCollisions(p.x, p.y); assert.equal(engine.state.stats.collisions, 0);
  p.x += 11; engine._worldCollisions(p.x - 11,p.y); assert.equal(engine.state.stats.lightHits, 1); assert.equal(engine.state.phase, 'race');
});

test('player receives no throttle or steering assistance', () => {
  const engine = fresh(); startRace(engine); const x=engine.state.player.x,y=engine.state.player.y,h=engine.state.player.heading;
  run(engine, 2, {}); assert.equal(engine.state.player.x, x); assert.equal(engine.state.player.y, y); assert.equal(engine.state.player.heading, h);
  run(engine, 2, {throttle: 1}); assert.ok(engine.state.player.speed > 5);
  assert.ok(Math.hypot(engine.state.player.x-x,engine.state.player.y-y)>5);
});

test('rain materially reduces turning grip, and settings are sanitized', () => {
  const dry=fresh(),wet=fresh();startRace(dry);startRace(wet,{weather:'rain'});
  dry.state.player.speed=12;wet.state.player.speed=12;
  dry.update(1/120,{steer:1});wet.update(1/120,{steer:1});
  assert.ok(Math.abs(angleDiff(dry.state.player.heading,data.tracks[0] && sampleTrack(data.tracks[0],0).heading)) > Math.abs(angleDiff(wet.state.player.heading,sampleTrack(data.tracks[0],0).heading)));
  dry.setSettings({quality:'unsafe',controlScale:99,controlOpacity:-2});
  assert.equal(dry.save.settings.quality,'balanced');assert.equal(dry.save.settings.controlScale,1.4);assert.equal(dry.save.settings.controlOpacity,.25);
});

test('pause/countdown and fixed stepping do not advance a frozen race', () => {
  const engine=fresh();engine.start();run(engine,1,{});assert.ok(engine.state.countdown>1.9);
  engine.pause();const countdown=engine.state.countdown;run(engine,2,{throttle:1});assert.equal(engine.state.countdown,countdown);
  engine.resume();run(engine,2.1,{});assert.equal(engine.state.phase,'race');
  const elapsed=engine.state.elapsed;engine.pause();run(engine,1,{throttle:1});assert.equal(engine.state.elapsed,elapsed);
});

test('a real OSM lap can finish using throttle/brake/steer only, without position edits or rescue', () => {
  const engine = fresh(); startRace(engine, {track: 6, carryEnabled: false, difficulty: .7});
  // Test-only feedback driver: the shipped player controller contains no such assistance.
  for (let step = 0; step < 120 * 180 && engine.state.phase === 'race'; step++) {
    const p = engine.state.player, track = engine.state.track;
    const aim = sampleTrack(track, p.progress + Math.max(6, p.speed * .7));
    const before = sampleTrack(track, p.progress), after = sampleTrack(track, p.progress + 30);
    const error = angleDiff(Math.atan2(aim.y - p.y, aim.x - p.x), p.heading);
    const curve = Math.abs(angleDiff(after.heading, before.heading));
    const targetSpeed = Math.max(5, Math.min(19, 13 / (1 + curve * 1.5)));
    engine.update(1 / 120, {steer: Math.max(-1, Math.min(1, error * 3)),
      throttle: p.speed < targetSpeed ? 1 : 0, brake: p.speed > targetSpeed + 1 ? .4 : 0});
  }
  assert.equal(engine.state.phase, 'result');
  assert.equal(engine.state.result.valid, true);
  assert.equal(engine.state.stats.checkpointsPassed, engine.state.checkpoints.length);
  assert.equal(engine.state.stats.penalties, 0); assert.equal(engine.state.stats.collisions, 0);
  assert.ok(engine.state.stats.distanceDriven > 600);
});


test('progress backups round-trip and reject unrelated or oversized files', async () => {
  const {exportProgress,importProgress}=await import('../src/progress.js');
  const engine=fresh();engine.save.totalCarries=9;engine.save.unlocked=4;
  assert.equal(importProgress(exportProgress(engine.save)).totalCarries,9);
  assert.equal(importProgress(exportProgress(engine.save)).unlocked,4);
  assert.throws(()=>importProgress('{"hello":1}'));
  assert.throws(()=>importProgress('a'.repeat(250001)));
});

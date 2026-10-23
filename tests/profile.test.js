import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile, normalizeSettings, sanitizeName, displayName, replaceNames, upgradeCost, upgradeVehicle, tunedVehicle, setCosmetics, MAX_UPGRADE_LEVEL, UPGRADE_KINDS, HEART_BRACELET} from '../src/profile.js';

const bike = {id: 'r1', max: 58, acc: 7.8, grip: 1.06};

test('V8 progress is preserved while V9 reward fields start unearned', () => {
  const old = {version: 8, unlocked: 5, wins: {0: true, 4: true}, best: {'story.4.1.0': 96.3}, totalCarries: 12, affection: 8, gifts: 4,
    badges: {boss_lucien_clear: true}, settings: {quality: 'high', weather: 'rain'}, legacyNote: {value: 42}};
  const before = JSON.stringify(old), save = normalizeProfile(old);
  assert.equal(save.version, 9); assert.equal(save.unlocked, 5); assert.deepEqual(save.wins, old.wins); assert.deepEqual(save.best, old.best);
  assert.equal(save.totalCarries, 12); assert.equal(save.affection, 8); assert.equal(save.gifts, 4); assert.deepEqual(save.legacyNote, {value:42});
  assert.equal(save.coins, 0); assert.equal(save.endingUnlocked, false); assert.equal(save.memories.heart_bracelet, null); assert.equal(save.settings.quality, 'balanced');
  assert.equal(JSON.stringify(old), before, 'migration cannot mutate the loaded V8 value');
});

test('V9 profile reload retains names, purchased upgrades and an explicitly earned memory', () => {
  const save = normalizeProfile({version:9, unlocked:5, endingUnlocked:true, wins:{4:true}, coins:1000,
    characterNames:{aurora:'Hải Anh',lucien:'Minh Đức'},garage:{upgrades:{r1:{engine:2}}},memories:{heart_bracelet:{...HEART_BRACELET,receivedAt:'2026-10-22'}}});
  const restored = normalizeProfile(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored.characterNames, {aurora:'Hải Anh',lucien:'Minh Đức'}); assert.equal(restored.garage.upgrades.r1.engine,2);
  assert.equal(restored.memories.heart_bracelet.id,'heart_bracelet'); assert.equal(restored.endingUnlocked,true);
  const corrupt=normalizeProfile({version:8,endingUnlocked:true,memories:{heart_bracelet:{...HEART_BRACELET}}});
  assert.equal(corrupt.endingUnlocked,false);assert.equal(corrupt.memories.heart_bracelet,null);
});

test('names normalize Vietnamese Unicode, reject empty/markup and count graphemes', () => {
  assert.equal(sanitizeName('  Hải   Phòng  '), 'Hải Phòng');
  assert.equal(sanitizeName(' \n\t ', 'Lucien'),'Lucien');assert.equal(sanitizeName('<img src=x onerror=alert(1)>'),'Aurora');
  assert.equal(sanitizeName('---','Lucien'),'Lucien');assert.equal(sanitizeName('Bình\u202eAn'),'BìnhAn');
  const family='👩‍👩‍👦';assert.equal(sanitizeName(family.repeat(25)),family.repeat(20));
  assert.equal(sanitizeName('Đ'.repeat(25)),'Đ'.repeat(20));
});

test('display replacement respects stable IDs, whole Unicode words and swapped names', () => {
  const save=normalizeProfile({characterNames:{aurora:'Lucien',lucien:'Aurora'}});
  assert.equal(replaceNames('Aurora gặp Lucien. {aurora} & {lucien}',save),'Lucien gặp Aurora. Lucien & Aurora');
  assert.equal(replaceNames('Auroraville Lucienne xAurora Aurorađẹp _Lucien',save),'Auroraville Lucienne xAurora Aurorađẹp _Lucien');
  assert.equal(displayName(save,'minh'),'Minh');assert.equal(displayName(save,'aurora'),'Lucien');
  assert.equal(replaceNames('Aurora',normalizeProfile({characterNames:{aurora:'Hải & An'}})),'Hải & An');
});

test('settings migrate legacy quality names and bound camera/touch parameters', () => {
  assert.equal(normalizeSettings({quality:'low'}).quality,'performance');assert.equal(normalizeSettings({quality:'high'}).quality,'balanced');
  assert.equal(normalizeSettings({quality:'ultra'}).quality,'ultra');
  const s=normalizeSettings({quality:'invalid',controlScale:99,controlOpacity:-2,cameraShake:false,autoQuality:false});
  assert.equal(s.quality,'balanced');assert.equal(s.controlScale,1.4);assert.equal(s.controlOpacity,.25);assert.equal(s.cameraShake,0);assert.equal(s.autoQuality,false);
});

test('garage purchases deduct exactly once, preserve other bikes and enforce level/cost bounds', () => {
  const save=normalizeProfile({coins:5000});
  for (const kind of UPGRADE_KINDS) {
    const initial=save.coins, cost=upgradeCost(0,kind),result=upgradeVehicle(save,'r1',kind);
    assert.equal(result.ok,true);assert.equal(save.coins,initial-cost);assert.equal(save.garage.upgrades.r1[kind],1);
  }
  const cost2=upgradeCost(1,'engine'),before=save.coins;upgradeVehicle(save,'r1','engine');assert.equal(save.coins,before-cost2);
  upgradeVehicle(save,'r1','engine');assert.equal(save.garage.upgrades.r1.engine,MAX_UPGRADE_LEVEL);
  const maxSnapshot=JSON.stringify(save);assert.equal(upgradeVehicle(save,'r1','engine').ok,false);assert.equal(JSON.stringify(save),maxSnapshot);
  assert.equal(save.garage.upgrades.ninja.engine,0);assert.equal(upgradeCost(3,'engine'),0);
});

test('failed purchases are atomic and cannot spend negative/nonexistent money or arbitrary keys', () => {
  const save=normalizeProfile({coins:0});const before=JSON.stringify(save);
  assert.equal(upgradeVehicle(save,'r1','engine').reason,'insufficient-coins');assert.equal(JSON.stringify(save),before);
  assert.equal(upgradeVehicle(save,'__proto__','engine').ok,false);assert.equal(upgradeVehicle(save,'r1','constructor').ok,false);assert.equal(JSON.stringify(save),before);
  const dirty=normalizeProfile({coins:-20,garage:{upgrades:{r1:{engine:999,tires:-4}}}});
  assert.equal(dirty.coins,0);assert.equal(dirty.garage.upgrades.r1.engine,3);assert.equal(dirty.garage.upgrades.r1.tires,0);
});

test('effective tuning changes actual bike stats while preserving catalog and scooter identity', () => {
  const save=normalizeProfile({garage:{upgrades:{r1:{engine:3,tires:2,brakes:2,nitro:1,stability:2}}}});
  const source=JSON.stringify(bike),tuned=tunedVehicle(bike,save),scooter=tunedVehicle({id:'vespa',max:29,acc:4.2,grip:.96},save);
  assert.ok(tuned.acc>bike.acc);assert.ok(tuned.max>bike.max);assert.ok(tuned.grip>bike.grip);assert.ok(tuned.brakePower>15.5);assert.ok(tuned.nitroCapacity>100);assert.ok(tuned.stability>1);
  assert.ok(scooter.max<tuned.max);assert.ok(scooter.driftMinSpeed<tuned.driftMinSpeed);assert.ok(scooter.driftGrip>tuned.driftGrip);assert.equal(JSON.stringify(bike),source);
});

test('cosmetics change supported parts atomically without changing names or reward state', () => {
  const save=normalizeProfile({characterNames:{aurora:'Mai',lucien:'Nam'}}),before=JSON.stringify(save.characterNames);
  assert.equal(setCosmetics(save,{paint:'mint',helmet:'teal',jacket:'olive',gloves:'cream',accessory:'heart'}).ok,true);
  assert.equal(save.garage.cosmetics.paint,'mint');assert.equal(JSON.stringify(save.characterNames),before);assert.equal(save.memories.heart_bracelet,null);
  const snapshot=JSON.stringify(save);assert.equal(setCosmetics(save,{face:'different'}).ok,false);assert.equal(JSON.stringify(save),snapshot);
});

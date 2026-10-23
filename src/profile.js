/** V9 profile data: safe display names, bounded garage transactions and V8-compatible defaults.
 * No function in this module grants race prizes, memories or ending access.
 */
export const MAX_NAME_GRAPHEMES = 20;
export const MAX_UPGRADE_LEVEL = 3;
export const VEHICLE_IDS = Object.freeze(['r1', 'ninja', 'vespa', 'ducati']);
export const UPGRADE_KINDS = Object.freeze(['engine', 'tires', 'brakes', 'nitro', 'stability']);
export const DEFAULT_CHARACTER_NAMES = Object.freeze({aurora: 'Aurora', lucien: 'Lucien'});
const RIVAL_NAMES = Object.freeze({minh: 'Minh', nhi: 'Nhi', phong: 'Phong', rin: 'Rin'});
export const COSMETIC_OPTIONS = Object.freeze({
  paint: Object.freeze(['original', 'coral', 'ocean', 'mint', 'gold']),
  helmet: Object.freeze(['classic', 'cream', 'teal', 'coral']),
  jacket: Object.freeze(['original', 'navy', 'olive', 'coral']),
  gloves: Object.freeze(['black', 'cream', 'teal']),
  accessory: Object.freeze(['daisies', 'ribbon', 'heart'])
});
export const DEFAULT_COSMETICS = Object.freeze({paint: 'original', helmet: 'classic', jacket: 'original', gloves: 'black', accessory: 'daisies'});
export const HEART_BRACELET = Object.freeze({
  id: 'heart_bracelet', title: 'Vòng tay trái tim',
  description: 'Món quà cho nhà vô địch: một trái tim nhỏ nhắc nhớ hành trình hai người cùng đi.',
  asset: 'assets/v9-gift.png'
});
export const defaultV9Settings = Object.freeze({
  quality: 'balanced', time: 'day', weather: 'clear', sound: true, carryEnabled: true,
  controlScale: 1, controlOpacity: .7, autoQuality: true, cameraShake: .45
});

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const integer = (value, fallback = 0, max = 1_000_000_000) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Math.floor(Number(value)))) : fallback;
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity: 'grapheme'}) : null;
const graphemes = text => segmenter ? Array.from(segmenter.segment(text), part => part.segment) : Array.from(text);

function cleanedName(value) {
  if (typeof value !== 'string' || /[<>]/u.test(value)) return '';
  const clean = value.normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u061C\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, '')
    .replace(/\s+/gu, ' ').trim();
  if (!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(clean)) return '';
  return graphemes(clean).slice(0, MAX_NAME_GRAPHEMES).join('').trim();
}

/** Plain text only. Consumers must insert the returned value with textContent or escaping. */
export function sanitizeName(value, fallback = 'Aurora') {
  return cleanedName(value) || cleanedName(fallback) || DEFAULT_CHARACTER_NAMES.aurora;
}
export function displayName(save, id) {
  if (Object.hasOwn(DEFAULT_CHARACTER_NAMES, id)) return sanitizeName(save?.characterNames?.[id], DEFAULT_CHARACTER_NAMES[id]);
  return Object.hasOwn(RIVAL_NAMES, id) ? RIVAL_NAMES[id] : String(id ?? '');
}

/** Replace stable character tokens once, so swapped nicknames never cascade. */
export function replaceNames(text, save) {
  return String(text ?? '').replace(/\{(aurora|lucien)\}|(^|[^\p{L}\p{N}\p{M}_])(Aurora|Lucien)(?=$|[^\p{L}\p{N}\p{M}_])/gu,
    (_match, token, prefix, name) => token ? displayName(save, token) : `${prefix}${displayName(save, name === 'Aurora' ? 'aurora' : 'lucien')}`);
}

export function normalizeQuality(value) {
  if (value === 'low') return 'performance';
  if (value === 'high') return 'balanced';
  return ['performance', 'balanced', 'ultra'].includes(value) ? value : 'balanced';
}
export function normalizeSettings(raw = {}) {
  const settings = object(raw);
  return {...settings, ...defaultV9Settings,
    quality: normalizeQuality(settings.quality),
    time: ['day', 'sunset', 'night'].includes(settings.time) ? settings.time : 'day',
    weather: ['clear', 'rain', 'fog'].includes(settings.weather) ? settings.weather : 'clear',
    sound: settings.sound !== false, carryEnabled: settings.carryEnabled !== false,
    autoQuality: settings.autoQuality !== false,
    cameraShake: typeof settings.cameraShake === 'boolean' ? (settings.cameraShake ? .45 : 0) : clamp(settings.cameraShake, 0, 1, .45),
    controlScale: clamp(settings.controlScale, .75, 1.4, 1),
    controlOpacity: clamp(settings.controlOpacity, .25, 1, .7)};
}

export function normalizeCosmetics(raw = {}) {
  const cosmetics = object(raw), result = {...cosmetics};
  for (const key of Object.keys(COSMETIC_OPTIONS)) result[key] = COSMETIC_OPTIONS[key].includes(cosmetics[key]) ? cosmetics[key] : DEFAULT_COSMETICS[key];
  return result;
}

function cleanBest(raw) {
  const best = {};
  for (const [key, value] of Object.entries(object(raw))) {
    const n = Number(value); if (Number.isFinite(n) && n > 0) best[key] = n;
  }
  return best;
}
function cleanFlags(raw) {
  return Object.fromEntries(Object.entries(object(raw)).map(([key, value]) => [key, value === true || value === 1]));
}

/** Normalize a loaded V8/V9 save without touching storage or inventing rewards. */
export function normalizeProfile(raw = {}) {
  const source = object(raw), garage = object(source.garage), upgrades = {...object(garage.upgrades)};
  for (const id of VEHICLE_IDS) {
    const bike = object(upgrades[id]);
    upgrades[id] = {...bike};
    for (const kind of UPGRADE_KINDS) upgrades[id][kind] = integer(bike[kind], 0, MAX_UPGRADE_LEVEL);
  }
  const endingUnlocked = source.version === 9 && source.endingUnlocked === true;
  const memories = {...object(source.memories)}, bracelet = object(memories.heart_bracelet);
  // Old boss badges and preview flags cannot create the new story gift.
  memories.heart_bracelet = endingUnlocked && bracelet.id === HEART_BRACELET.id ? {...bracelet} : null;
  return {...source, version: 9,
    unlocked: integer(source.unlocked, 1, 5) || 1,
    wins: cleanFlags(source.wins), best: cleanBest(source.best), badges: cleanFlags(source.badges),
    totalCarries: integer(source.totalCarries), affection: integer(source.affection), gifts: integer(source.gifts),
    characterNames: {aurora: sanitizeName(source.characterNames?.aurora, 'Aurora'), lucien: sanitizeName(source.characterNames?.lucien, 'Lucien')},
    coins: integer(source.coins),
    garage: {...garage, upgrades, cosmetics: normalizeCosmetics(garage.cosmetics)},
    memories, endingUnlocked, settings: normalizeSettings(source.settings)};
}

/** The next upgrade price; zero means already at maximum. Kinds are validated separately. */
export function upgradeCost(level, kind = 'engine') {
  if (!UPGRADE_KINDS.includes(kind)) return 0;
  const current = integer(level, 0, MAX_UPGRADE_LEVEL);
  if (current >= MAX_UPGRADE_LEVEL) return 0;
  const multiplier = {engine: 1.15, tires: 1, brakes: .9, nitro: 1.1, stability: .85}[kind];
  return Math.round(([150, 300, 550][current] * multiplier) / 10) * 10;
}

/** Synchronous atomic purchase: failed purchases do not mutate the save. */
export function upgradeVehicle(save, vehicleId, kind) {
  if (!save || !VEHICLE_IDS.includes(vehicleId) || !UPGRADE_KINDS.includes(kind)) return {ok: false, reason: 'invalid', cost: 0};
  const level = integer(save.garage?.upgrades?.[vehicleId]?.[kind], 0, MAX_UPGRADE_LEVEL);
  if (level >= MAX_UPGRADE_LEVEL) return {ok: false, reason: 'max-level', cost: 0, level};
  const cost = upgradeCost(level, kind), coins = integer(save.coins);
  if (coins < cost) return {ok: false, reason: 'insufficient-coins', cost, level};
  const garage = object(save.garage), upgrades = object(garage.upgrades), bike = object(upgrades[vehicleId]);
  save.garage = {...garage, upgrades: {...upgrades, [vehicleId]: {...bike, [kind]: level + 1}}};
  save.coins = coins - cost;
  return {ok: true, reason: 'purchased', cost, level: level + 1, coins: save.coins};
}

/** Preserve original bike differences; return tuned stats without mutating the catalog or save. */
export function tunedVehicle(base, save) {
  const bike = base || {}, levels = object(save?.garage?.upgrades?.[bike.id]);
  const level = kind => integer(levels[kind], 0, MAX_UPGRADE_LEVEL);
  const scooter = bike.id === 'vespa';
  const stability = (scooter ? 1.1 : 1) + level('stability') * .075;
  return {...bike,
    acc: (Number(bike.acc) || 5) * (1 + .05 * level('engine')),
    max: (Number(bike.max) || 30) * (1 + .025 * level('engine')),
    grip: (Number(bike.grip) || 1) * (1 + .04 * level('tires') + .01 * level('stability')),
    brakePower: (scooter ? 13 : 15.5) * (1 + .08 * level('brakes')),
    nitroCapacity: (scooter ? 90 : 100) + level('nitro') * 10,
    nitroPower: (scooter ? 4.4 : 7.2) + level('nitro') * (scooter ? .55 : .85),
    stability,
    driftGrip: (scooter ? .85 : .73) + level('tires') * .018 + level('stability') * .01,
    driftMinSpeed: scooter ? 7.5 : 11,
    mass: scooter ? 130 : bike.id === 'ducati' ? 190 : 200,
    upgrades: Object.fromEntries(UPGRADE_KINDS.map(kind => [kind, level(kind)])),
    cosmetics: normalizeCosmetics(save?.garage?.cosmetics)};
}

/** Update only supported cosmetic selections. This never changes character identity. */
export function setCosmetics(save, changes) {
  const input = object(changes), selected = {...normalizeCosmetics(save?.garage?.cosmetics)};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(COSMETIC_OPTIONS, key) || !COSMETIC_OPTIONS[key].includes(value)) return {ok: false, reason: 'invalid'};
    selected[key] = value;
  }
  save.garage = {...object(save.garage), cosmetics: selected};
  return {ok: true, cosmetics: selected};
}

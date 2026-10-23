import {SpatialGrid,normalizeQuality} from './performance.js?v=10';
import {renderScale} from './display.js?v=10';
import {displayName} from './profile.js?v=10';
/** Hải Phòng Grand Prix V8 — coherent Canvas 2.5D city renderer.
 * World coordinates are the preserved OSM metre coordinates; the camera never
 * changes vehicle physics. Art is billboarded deliberately, like an illustrated
 * diorama, while all surfaces, gates, collisions and vehicles share one space.
 */
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const xy = p => Array.isArray(p) ? p : [p.x, p.y];
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
const SHOP_NAMES = ['CÀ PHÊ TAM BẠC', 'BÁNH ĐA CUA', 'TIỆM HOA NẮNG', 'NHÀ SÁCH MÙA HÈ', 'HẢI PHÒNG ƠI', 'BÁNH MÌ PHỐ', 'TRÀ & CHUYỆN', 'GÓC HẸN HÒ', 'MÂY • BOUTIQUE', 'KEM BỜ HỒ', 'TIỆM ẢNH GÓC PHỐ', 'ĐỒNG HỒ HẠNH PHÚC'];
const PALETTES = [
  { wall: '#eed9b0', shade: '#c9ad85', roof: '#78676b', trim: '#edf0da', sign: '#2f6c65', awning: '#528e78' },
  { wall: '#e6bba6', shade: '#b78a7f', roof: '#647b7b', trim: '#f9ecce', sign: '#8d4d50', awning: '#bc7770' },
  { wall: '#bad1c1', shade: '#8ca99a', roof: '#66747b', trim: '#f9edcf', sign: '#365b66', awning: '#477e83' },
  { wall: '#e9dec1', shade: '#b8ac92', roof: '#8f7869', trim: '#fff5d9', sign: '#74613f', awning: '#c4a45e' },
  { wall: '#becbd6', shade: '#8d9dad', roof: '#6c7b88', trim: '#f2eadb', sign: '#385a79', awning: '#527895' },
  { wall: '#e7c4c1', shade: '#b98b91', roof: '#89707b', trim: '#f7e4c8', sign: '#865570', awning: '#ac718c' },
];
const THEMES = {
  day: { skyTop: '#87c9dc', skyBottom: '#e3ebcb', ground: '#b4bd9b', water: '#70b6bd', waterEdge: '#a0cdc4', park: '#95b681', road: '#626f78', roadEdge: '#8e999d', pavement: '#d4c7ad', haze: '#dce8cf', shadow: '#3c616350' },
  sunset: { skyTop: '#9fadc8', skyBottom: '#ffce9d', ground: '#c0b295', water: '#a9b8bd', waterEdge: '#e2c7af', park: '#a4ad7c', road: '#72727b', roadEdge: '#a0928a', pavement: '#ddc1a0', haze: '#ebc4b0', shadow: '#74566a55' },
  night: { skyTop: '#102b47', skyBottom: '#426584', ground: '#3d5c65', water: '#315e79', waterEdge: '#6b8b9b', park: '#3d6b65', road: '#334c60', roadEdge: '#587381', pavement: '#6d8589', haze: '#31546b', shadow: '#14283f80' },
};

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
function polygon(ctx, points, fill, stroke, width = 1) {
  if (points.length < 3) return;
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function rounded(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

/** Detailed drawn storefronts are a fallback, not stand-ins for generated heroes. */
function makeShop(index, night = false) {
  const c = canvas(380, 530), g = c.getContext('2d');
  const p = PALETTES[index % PALETTES.length];
  const floors = 2 + index % 2, left = 45, front = 262, top = 440 - floors * 118;
  g.lineJoin = 'round';
  // Layered eaves and side wall make these complete illustrated buildings.
  polygon(g, [[left + front, top], [left + front + 47, top - 20], [left + front + 47, 430], [left + front, 452]], p.shade, '#47626a', 2);
  const wall = g.createLinearGradient(left, 0, left + front, 0); wall.addColorStop(0, p.wall); wall.addColorStop(.8, p.wall); wall.addColorStop(1, p.shade);
  rounded(g, left, top, front, 452 - top, 2, wall, '#65706a');
  for (let f = 0; f < floors; f++) {
    const yy = top + f * 118;
    g.fillStyle = p.trim; g.fillRect(left - 4, yy + 3, front + 8, 8);
    g.fillStyle = '#6a787a33'; g.fillRect(left, yy + 11, front, 5);
    for (let b = 0; b < 2; b++) {
      const xx = left + 24 + b * 124;
      rounded(g, xx - 5, yy + 26, 91, 70, 5, p.trim, '#75817d');
      const win = g.createLinearGradient(xx, yy + 29, xx + 75, yy + 90);
      win.addColorStop(0, night ? '#f8d991' : '#63878b'); win.addColorStop(.55, night ? '#e1b373' : '#a5c2c0'); win.addColorStop(.58, night ? '#f2cf85' : '#68898e'); win.addColorStop(1, night ? '#d69366' : '#b6c7bd');
      g.fillStyle = win; g.fillRect(xx + 5, yy + 31, 71, 59);
      g.strokeStyle = p.trim; g.lineWidth = 3;
      g.beginPath(); g.moveTo(xx + 41, yy + 31); g.lineTo(xx + 41, yy + 90); g.moveTo(xx + 6, yy + 58); g.lineTo(xx + 76, yy + 58); g.stroke();
      // Shutters have individual slats, not flat blocks.
      for (let s = 0; s < 2; s++) {
        const sx = xx - 9 + s * 89;
        g.fillStyle = p.sign; g.fillRect(sx, yy + 30, 12, 63);
        g.strokeStyle = '#e9e5c04d'; g.lineWidth = 1;
        for (let q = 0; q < 8; q++) { g.beginPath(); g.moveTo(sx + 2, yy + 35 + q * 7); g.lineTo(sx + 10, yy + 35 + q * 7); g.stroke(); }
      }
      if ((index + f) % 2 === 0) {
        g.fillStyle = '#79877d'; g.fillRect(xx - 13, yy + 89, 108, 9);
        g.strokeStyle = '#49666b'; g.lineWidth = 2;
        for (let q = 0; q < 10; q++) { g.beginPath(); g.moveTo(xx - 10 + q * 11, yy + 75); g.lineTo(xx - 10 + q * 11, yy + 92); g.stroke(); }
        g.strokeRect(xx - 14, yy + 74, 110, 17);
        for (let q = 0; q < 5; q++) {
          g.fillStyle = ['#5d8f68', '#74945c', '#4e815b'][q % 3]; g.beginPath(); g.ellipse(xx - 3 + q * 22, yy + 91, 15, 7, -.2, 0, TAU); g.fill();
          g.fillStyle = '#df8f8d'; g.beginPath(); g.arc(xx + q * 22, yy + 87, 3, 0, TAU); g.fill();
        }
      }
    }
    // Drainpipe, cable and small wall lamps.
    g.strokeStyle = p.shade; g.lineWidth = 4; g.beginPath(); g.moveTo(left + 8, yy + 10); g.lineTo(left + 8, yy + 117); g.stroke();
    g.fillStyle = p.trim; g.fillRect(left + front - 34, yy + 82, 27, 20); g.strokeStyle = '#80908b'; g.lineWidth = 1;
    for (let q = 0; q < 5; q++) { g.beginPath(); g.moveTo(left + front - 31, yy + 85 + q * 3); g.lineTo(left + front - 10, yy + 85 + q * 3); g.stroke(); }
  }
  // Ground-floor shops with glass, door, interiors and legible Vietnamese signs.
  g.fillStyle = p.shade; g.fillRect(left + 6, 342, front - 12, 109);
  const glass = g.createLinearGradient(0, 350, 0, 440); glass.addColorStop(0, night ? '#e8bc7d' : '#57767a'); glass.addColorStop(1, night ? '#b78060' : '#375a63');
  g.fillStyle = glass; g.fillRect(left + 16, 354, front - 32, 94);
  g.fillStyle = '#e3d5b0'; g.fillRect(left + 146, 350, 6, 100); g.fillRect(left + 9, 391, front - 18, 4);
  g.fillStyle = '#b4bfaa77'; g.fillRect(left + 26, 364, 77, 15); g.fillRect(left + 36, 402, 65, 22);
  g.strokeStyle = '#f4e3bb88'; g.lineWidth = 3; g.beginPath(); g.moveTo(left + 34, 355); g.lineTo(left + 18, 432); g.moveTo(left + 77, 355); g.lineTo(left + 58, 432); g.stroke();
  g.fillStyle = '#e8d7ac'; g.fillRect(left + 158, 402, 5, 12);
  rounded(g, left - 5, 308, front + 10, 38, 3, p.sign, '#e5cfac');
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff1d2'; g.font = 'bold 16px sans-serif'; g.fillText(SHOP_NAMES[index % SHOP_NAMES.length], left + front / 2, 327, front - 18);
  // Scalloped striped awning.
  polygon(g, [[left - 9, 346], [left + front + 9, 346], [left + front + 23, 366], [left - 23, 366]], p.awning, '#556b64', 1);
  for (let a = 0; a < 10; a++) {
    g.fillStyle = a % 2 ? p.trim : p.awning;
    const ax = left - 23 + a * (front + 46) / 10;
    g.fillRect(ax, 366, (front + 46) / 10, 11);
    g.beginPath(); g.ellipse(ax + (front + 46) / 20, 377, (front + 46) / 20, 4, 0, 0, Math.PI); g.fill();
  }
  // Ornate roofline and terracotta tiles, varied gable and parapet.
  polygon(g, [[left - 9, top], [left + front + 8, top], [left + front + 54, top - 24], [left + 28, top - 24]], p.roof, '#526371', 2);
  for (let a = 0; a < 14; a++) { g.strokeStyle = '#d8d7c355'; g.lineWidth = 2; g.beginPath(); g.moveTo(left - 7 + a * 21, top); g.lineTo(left + 29 + a * 21, top - 23); g.stroke(); }
  g.fillStyle = p.trim; g.fillRect(left - 9, top - 3, front + 17, 8);
  if (index % 3 === 0) {
    polygon(g, [[left + 69, top - 1], [left + 133, top - 43], [left + 197, top - 1]], p.wall, '#66746a', 2);
    g.fillStyle = p.sign; g.font = '11px Georgia'; g.fillText('HẢI PHÒNG · 1930', left + front / 2, top - 12);
  }
  // Pavement base, plants and café chalkboard.
  polygon(g, [[left - 13, 450], [left + front + 1, 450], [left + front + 51, 431], [left + front + 49, 442], [left + front, 462], [left - 13, 462]], '#c7baa2', '#8a9283', 1);
  if (index % 2 === 0) {
    rounded(g, left + 175, 410, 51, 52, 3, '#344f51', '#d2c7a5');
    g.font = 'bold 7px sans-serif'; g.fillStyle = '#f7e9c4'; g.fillText('HÔM NAY', left + 200, 425); g.font = '8px cursive'; g.fillText('Cà phê sữa', left + 200, 438); g.fillText('25k ♡', left + 200, 451);
  }
  for (let q = 0; q < 2; q++) {
    const xx = left + 9 + q * 230;
    g.fillStyle = '#ae7e68'; polygon(g, [[xx - 10, 439], [xx + 10, 439], [xx + 7, 459], [xx - 7, 459]], '#ae7e68', '#855b4e');
    for (let z = 0; z < 5; z++) { g.fillStyle = z % 2 ? '#6c9664' : '#497a5d'; g.beginPath(); g.ellipse(xx + Math.sin(z * 2.5) * 8, 423 + z * 2, 7, 15, (z - 2) * .3, 0, TAU); g.fill(); }
  }
  return c;
}

function makeTree(index = 0) {
  const c = canvas(220, 320), g = c.getContext('2d');
  g.strokeStyle = '#69715b'; g.lineWidth = 13; g.lineCap = 'round'; g.beginPath(); g.moveTo(110, 303); g.bezierCurveTo(102, 247, 121, 192, 105, 106); g.stroke();
  g.strokeStyle = '#877f61'; g.lineWidth = 5; g.beginPath(); g.moveTo(106, 295); g.lineTo(111, 205); g.moveTo(110, 215); g.lineTo(63, 167); g.moveTo(110, 183); g.lineTo(156, 139); g.stroke();
  const colors = index % 2 ? ['#416e61', '#588767', '#739b6c', '#92b47a'] : ['#377970', '#518f70', '#75a376', '#a1bb80'];
  for (let layer = 0; layer < 4; layer++) {
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4 + layer, r = 35 + hash(i + index * 30) * 35;
      g.fillStyle = colors[layer];
      g.beginPath(); g.ellipse(110 + Math.cos(a) * r * .68 - layer * 2, 116 + Math.sin(a) * r * .72 - layer * 6, 43 - layer * 5, 41 - layer * 3, a, 0, TAU); g.fill();
    }
  }
  if (index % 3 === 0) {
    for (let i = 0; i < 23; i++) { const x = 48 + hash(i * 9) * 120, y = 60 + hash(i * 13) * 114; g.fillStyle = i % 3 ? '#dd816b' : '#f8b477'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
  }
  return c;
}

function makeLamp(night = false) {
  const c = canvas(96, 270), g = c.getContext('2d');
  g.strokeStyle = '#456570'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(49, 258); g.lineTo(49, 45); g.bezierCurveTo(49, 12, 84, 24, 83, 44); g.stroke();
  g.fillStyle = '#476b73'; g.fillRect(43, 253, 12, 11); g.fillRect(45, 57, 9, 6);
  if (night) { const a = g.createRadialGradient(82, 45, 0, 82, 45, 35); a.addColorStop(0, '#fff2bdbb'); a.addColorStop(1, '#ffdc8f00'); g.fillStyle = a; g.fillRect(45, 10, 51, 77); }
  polygon(g, [[70, 39], [94, 39], [90, 53], [75, 53]], night ? '#ffe4a1' : '#d5debd', '#345c6c', 2);
  return c;
}

/** Small, drawn spectators have poses and grounded shadows, safely outside road. */
function makeSpectator(index = 0) {
  const c = canvas(104, 170), g = c.getContext('2d');
  const skin = ['#e4b98d', '#efc8a2', '#d49b7c'][index % 3], shirt = ['#de9b87', '#e8d8ad', '#83a9ad', '#d3b7c5', '#8fa578'][index % 5];
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#4c5a68'; g.lineWidth = 11;
  g.beginPath(); g.moveTo(45, 111); g.lineTo(42, 153); g.moveTo(59, 111); g.lineTo(64, 152); g.stroke();
  g.strokeStyle = '#385060'; g.lineWidth = 9; g.beginPath(); g.moveTo(37, 156); g.lineTo(47, 156); g.moveTo(60, 156); g.lineTo(71, 156); g.stroke();
  rounded(g, 33, 69, 38, 48, 10, shirt, '#69716b');
  g.strokeStyle = shirt; g.lineWidth = 11; g.beginPath(); g.moveTo(36, 77); g.lineTo(23, 97); g.moveTo(66, 77); g.lineTo(83, 61); g.lineTo(86, index % 2 ? 38 : 52); g.stroke();
  g.strokeStyle = skin; g.lineWidth = 7; g.beginPath(); g.moveTo(85, index % 2 ? 38 : 52); g.lineTo(88, index % 2 ? 31 : 44); g.stroke();
  g.fillStyle = '#343c45'; if (index % 3 === 0) { g.save(); g.translate(87, 33); g.rotate(.1); g.fillRect(-5, -9, 10, 17); g.fillStyle = '#87aeb8'; g.fillRect(-3, -6, 6, 11); g.restore(); }
  g.fillStyle = skin; g.fillRect(46, 60, 12, 13); g.beginPath(); g.ellipse(52, 47, 19, 22, 0, 0, TAU); g.fill();
  g.fillStyle = ['#3f373b', '#665141', '#303f4a'][index % 3]; g.beginPath(); g.ellipse(52, 39, 21, 18, -.08, Math.PI, TAU); g.lineTo(72, 53); g.lineTo(65, 36); g.lineTo(35, 44); g.fill();
  g.fillStyle = '#3d404b'; g.fillRect(44, 47, 3, 4); g.fillRect(58, 47, 3, 4);
  g.strokeStyle = '#a47067'; g.lineWidth = 1.8; g.beginPath(); g.arc(52, 53, 5, .1, Math.PI - .1); g.stroke();
  return c;
}

function makeObstacle(type) {
  const c = canvas(130, 130), g = c.getContext('2d'); g.lineJoin = 'round';
  if (type === 'cone') {
    polygon(g, [[23, 111], [77, 122], [115, 106], [56, 97]], '#5d6672', '#405461', 2);
    polygon(g, [[49, 104], [88, 110], [70, 22], [61, 20]], '#e79363', '#9e6858', 2);
    polygon(g, [[55, 65], [78, 69], [82, 83], [52, 78]], '#fff0d8');
    polygon(g, [[59, 44], [74, 47], [77, 59], [57, 56]], '#fff0d8');
  } else if (type === 'crate') {
    polygon(g, [[20, 47], [84, 36], [113, 51], [47, 64]], '#d2aa77', '#9b7857', 2);
    polygon(g, [[20, 47], [47, 64], [47, 114], [20, 97]], '#aa855f', '#7d6756', 2);
    polygon(g, [[47, 64], [113, 51], [113, 104], [47, 114]], '#c49c6d', '#7d6756', 2);
    g.strokeStyle = '#8c7055'; g.lineWidth = 3; g.beginPath(); g.moveTo(54, 69); g.lineTo(107, 99); g.moveTo(54, 106); g.lineTo(107, 58); g.stroke();
    g.fillStyle = '#eee0ba'; g.fillRect(72, 72, 23, 16); g.fillStyle = '#8c785c'; g.font = '9px sans-serif'; g.fillText('↑ ↑', 75, 84);
  } else {
    polygon(g, [[8, 81], [18, 47], [116, 47], [123, 81]], '#f1d0a3', '#8a7469', 2);
    for (let i = 0; i < 4; i++) polygon(g, [[16 + i * 27, 49], [30 + i * 27, 49], [43 + i * 27, 79], [29 + i * 27, 79]], '#c66e59');
    g.fillStyle = '#627079'; g.fillRect(21, 81, 7, 30); g.fillRect(104, 81, 7, 30); g.fillRect(14, 109, 22, 5); g.fillRect(98, 109, 22, 5);
    g.fillStyle = '#ecc87c'; g.beginPath(); g.arc(22, 40, 7, 0, TAU); g.arc(107, 40, 7, 0, TAU); g.fill();
  }
  return c;
}

function makeBench() {
  const c = canvas(160, 90), g = c.getContext('2d'); g.lineCap = 'round';
  g.strokeStyle = '#486473'; g.lineWidth = 7; g.beginPath(); g.moveTo(32, 33); g.lineTo(31, 76); g.moveTo(126, 33); g.lineTo(126, 76); g.stroke();
  for (let i = 0; i < 3; i++) { g.fillStyle = i === 1 ? '#ae9374' : '#c5aa7e'; g.fillRect(17, 22 + i * 12, 124, 8); }
  polygon(g, [[16, 57], [140, 57], [151, 66], [22, 66]], '#c5aa7e', '#8f8973', 1); return c;
}
function makeBicycle() {
  const c = canvas(150, 100), g = c.getContext('2d'); g.strokeStyle = '#465f6c'; g.lineWidth = 4;
  for (const x of [30, 118]) { g.beginPath(); g.ellipse(x, 67, 23, 24, 0, 0, TAU); g.stroke(); g.strokeStyle = '#c6c9ba'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(x, 67); g.lineTo(x + Math.cos(a) * 22, 67 + Math.sin(a) * 23); g.stroke(); } g.strokeStyle = '#465f6c'; g.lineWidth = 4; }
  g.strokeStyle = '#b06f65'; g.lineWidth = 4; g.beginPath(); g.moveTo(30, 67); g.lineTo(62, 33); g.lineTo(83, 67); g.lineTo(30, 67); g.moveTo(62, 33); g.lineTo(103, 32); g.lineTo(83, 67); g.lineTo(118, 67); g.lineTo(101, 21); g.lineTo(111, 17); g.stroke(); g.strokeStyle = '#465f6c'; g.beginPath(); g.moveTo(61, 24); g.lineTo(60, 35); g.moveTo(51, 24); g.lineTo(69, 24); g.stroke(); return c;
}

function makePickup() {
  const c = canvas(100, 110), g = c.getContext('2d');
  g.shadowColor = '#ffe9a4'; g.shadowBlur = 20; g.fillStyle = '#ffcd7a'; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 21 : 40; i ? g.lineTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r) : g.moveTo(50, 50 - r); }
  g.closePath(); g.fill(); g.shadowBlur = 0; g.strokeStyle = '#fff0c2'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#d29357'; g.font = 'bold 27px Georgia'; g.textAlign = 'center'; g.fillText('♡', 50, 60); return c;
}

function samplePath(points, step = 6) {
  let ps = points.map(xy), out = [], distance = 0, target = 0;
  if (ps.length < 2) return [];
  if (Math.hypot(ps[0][0] - ps.at(-1)[0], ps[0][1] - ps.at(-1)[1]) > .1) ps = [...ps, ps[0]];
  // Uniform arc-length sampling is important: OSM corner nodes are dense and
  // must not accidentally multiply roadside props at every bend.
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[i], b = ps[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < .001) continue;
    while (target < distance + len) {
      const t = (target - distance) / len;
      out.push({ x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), distance: target });
      target += step;
    }
    distance += len;
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[(i + out.length - 1) % out.length], b = out[(i + 1) % out.length], cur = out[i];
    let dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    cur.nx = -dy / len; cur.ny = dx / len; cur.heading = Math.atan2(dy, dx);
  }
  out.totalLength = distance;
  return out;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
  });
}

export class Renderer {
  constructor(target, data) {
    this.canvas = target; this.ctx = target.getContext('2d', { alpha: false }); this.data = data;
    this.dynamicScale=1;this.detail=1;this.mipCache=new WeakMap();this._nearProps=[];this._nearRoads=[];this._nearSamples=[];this.particles=Array.from({length:80},()=>({life:0}));this.particleCursor=0;this.particleClock=0;
    this.quality = 'balanced'; this.time = 0; this.width = 0; this.height = 0; this.dpr = 1;
    this.assets = {}; this.manifest = {}; this.routeCache = new Map(); this.camera = null;
    this.stats = { fps: 0, frameMs: 0, visibleObjects: 0, quality: 'high' };
    this._fpsTime = 0; this._fpsFrames = 0; this._drawObjects = [];
    this.shops = { day: [], night: [] };
    this.trees = []; this.spectators = [];
    this.lamps = [makeLamp(false), makeLamp(true)];
    this.bench = makeBench(); this.bicycle = makeBicycle(); this.pickup = makePickup();
    this.obstacleArt = { cone: makeObstacle('cone'), crate: makeObstacle('crate'), barrier: makeObstacle('barrier') };
    this.clouds = Array.from({ length: 8 }, (_, i) => ({ x: hash(i * 8) * 1.4 - .2, y: .08 + hash(i * 7) * .17, w: 70 + hash(i * 6) * 180 }));
    for (let i = 0; i < 10; i++) this.spectators.push(makeSpectator(i));
    this.roadGrid=new SpatialGrid(96);
    for(const road of data.geo.roads||[]){if(road.width<5||['footway','path','steps'].includes(road.kind))continue;
      for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],len=Math.hypot(a[0]-b[0],a[1]-b[1]),count=Math.max(1,Math.ceil(len/36));
        for(let j=0;j<count;j++){const p=[a[0]+(b[0]-a[0])*j/count,a[1]+(b[1]-a[1])*j/count],q=[a[0]+(b[0]-a[0])*(j+1)/count,a[1]+(b[1]-a[1])*(j+1)/count];this.roadGrid.insert({a:p,b:q,width:road.width,x:(p[0]+q[0])/2,y:(p[1]+q[1])/2});}}
    }
    this.resize();
  }

  async load() {
    try {
      const res = await fetch(new URL('../assets/manifest.json', import.meta.url),{cache:'no-cache'});
      if (res.ok) this.manifest = await res.json();
    } catch { /* Authored fallback city remains available if an optional art fails. */ }
    const base = new URL('../', import.meta.url);
    const entries = [];
    const walk = (node, path = '') => {
      if (typeof node === 'string' && /\.(png|webp|jpe?g|svg)(\?.*)?$/i.test(node)) entries.push([path, { src: node }]);
      else if (node && typeof node === 'object') {
        if (node.src || node.path || node.url) entries.push([path, node]);
        else for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
      }
    };
    walk(this.manifest);
    this.deferredAssets=entries.filter(([key])=>key.startsWith('ending.')||key==='duo');
    const immediateAssets=entries.filter(([key])=>!key.startsWith('ending.')&&key!=='duo');
    const decodedImages = new Map();
    await Promise.all(immediateAssets.map(async ([key, info]) => {
      const src = info.src || info.path || info.url;
      const url = src.startsWith('http') || src.startsWith('data:') || src.startsWith('/') ? src : new URL(src.replace(/^\.\//, ''), base).href;
      if (!decodedImages.has(url)) decodedImages.set(url, loadImage(url));
      const img = await decodedImages.get(url);
      if (img) this.assets[key] = { ...info, image: img };
    }));
    // Retain fallback canvases only when needed; decoded atlases supply the production art.
    if (!this.findAsset(['buildings','city.buildings','architecture','shops'])) {
      for (let i=0;i<12;i++) {this.shops.day.push(makeShop(i));this.shops.night.push(makeShop(i,true));}
    }
    if (!this.findAsset(['trees','city.trees','environment.trees'])) {
      for (let i=0;i<4;i++)this.trees.push(makeTree(i));
    }
    return this;
  }

  loadEndingAssets(){
    if(this._endingLoad)return this._endingLoad;
    const base=new URL('../',import.meta.url);
    this._endingLoad=Promise.all((this.deferredAssets||[]).map(async([key,info])=>{
      const source=info.src||info.path||info.url;
      const url=source.startsWith('/')||source.startsWith('data:')||source.startsWith('http')?source:new URL(source.replace(/^\.\//,''),base).href;
      const image=await loadImage(url);
      if(image)this.assets[key]={...info,image};
    }));
    return this._endingLoad;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width || innerWidth), h = Math.max(1, rect.height || innerHeight);
    const dpr=renderScale(w,h,this.quality,globalThis.devicePixelRatio||1,this.dynamicScale);
    if (w !== this.width || h !== this.height || dpr !== this.dpr) {
      this.width = w; this.height = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  prepareTrack(track) {
    if (!track?.points?.length) return null;
    const key = track.name || track.id || track.points;
    if (this.routeCache.has(key)) return this.routeCache.get(key);
    const samples = samplePath(track.points, 6);
    const halfWidth = track.halfWidth || (track.width ? track.width / 2 : 8);
    const props = [];
    const waterAreas = (this.data.geo?.areas || []).filter(a => a.type === 'water');
    const parkAreas = (this.data.geo?.areas || []).filter(a => ['park', 'garden', 'grass', 'recreation_ground'].includes(a.type));
    const isWater = (x, y) => waterAreas.some(a => pointInPolygon(x, y, a.points) && !(a.holes || []).some(h => pointInPolygon(x, y, h)));
    const isPark = (x, y) => parkAreas.some(a => pointInPolygon(x, y, a.points));
    const sampleGrid=new SpatialGrid(48);samples.forEach((p,i)=>sampleGrid.insert({...p,i}));
    const nearestDistance = (x, y, omitIndex) => {
      let min = Infinity;
      for(const p of sampleGrid.query(x,y,55,this._nearSamples)){
        if(Math.abs(p.i-omitIndex)<4)continue;min=Math.min(min,Math.hypot(x-p.x,y-p.y));
      }
      return min;
    };
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      for (const side of [-1, 1]) {
        if (i % 4 === 0) {
          const off = halfWidth + 5.8, x = p.x + p.nx * off * side, y = p.y + p.ny * off * side;
          if (!isWater(x, y) && nearestDistance(x, y, i) > halfWidth + 1) props.push({ kind: 'lamp', x, y, w: 2.3, h: 8, id: i + side });
        }
        if (i % 5 === 2) {
          const off = halfWidth + 6.2, x = p.x + p.nx * off * side, y = p.y + p.ny * off * side;
          if (!isWater(x, y) && nearestDistance(x, y, i) > halfWidth + 2) props.push({ kind: 'tree', x, y, w: 8 + hash(i) * 3, h: 11 + hash(i + side) * 4, variant: i % 4, id: i + side });
        }
        // Frontage follows the street, not a random cloud of boxes.
        if (i % 4 === 0) {
          const off = halfWidth + 20 + hash(i) * 4, x = p.x + p.nx * off * side, y = p.y + p.ny * off * side;
          if (!isWater(x, y) && !isPark(x, y) && nearestDistance(x, y, i) > halfWidth + 11) props.push({ kind: 'shop', x, y, w: 20 + hash(i + side) * 3, h: 25 + hash(i * 3 + side) * 4, variant: (i / 4 + (side === 1 ? 3 : 0)) % 12, id: i + side });
        }
        if (i % 11 === 3) {
          const off = halfWidth + 4.9, x = p.x + p.nx * off * side, y = p.y + p.ny * off * side;
          if (!isWater(x, y) && nearestDistance(x, y, i) > halfWidth + 1.5) {
            props.push({ kind: 'bench', x, y, w: 3.2, h: 1.6, id: i });
            props.push({ kind: 'bicycle', x: x + p.nx * 2 * side, y: y + p.ny * 2 * side, w: 2.8, h: 1.8, id: i });
          }
        }
        if (i % 3 === 1) {
          const off = halfWidth + 2.9, x = p.x + p.nx * off * side, y = p.y + p.ny * off * side;
          if (!isWater(x, y) && nearestDistance(x, y, i) > halfWidth + .5) for (let n = 0; n < 2 + i % 3; n++) {
            props.push({ kind: 'person', x: x + Math.cos(p.heading) * (n - 1) * 1.2, y: y + Math.sin(p.heading) * (n - 1) * 1.2, w: .85, h: 1.8, variant: (i + n + (side === 1 ? 2 : 0)) % 10, id: i * 9 + n });
          }
        }
      }
      // Side barriers have a gap only at the start gate; no invisible blocking objects.
      if (i % 2 === 0 && !(track.shortcuts||[]).some(b=>Math.hypot(p.x-b.points[0][0],p.y-b.points[0][1])<15||Math.hypot(p.x-b.points.at(-1)[0],p.y-b.points.at(-1)[1])<15)) for (const side of [-1, 1]) props.push({ kind: 'barrier', x: p.x + p.nx * (halfWidth + .3) * side, y: p.y + p.ny * (halfWidth + .3) * side, w: 3, h: .9, heading: p.heading, variant: i % 6, id: i * side });
      // Route-facing signs are placed before significant turns.
      const future = samples[(i + 7) % samples.length];
      const bend = angleDelta(future.heading, p.heading);
      if (i % 9 === 0 && Math.abs(bend) > .28) props.push({ kind: 'turn', x: p.x + p.nx * (halfWidth + 2) * Math.sign(bend), y: p.y + p.ny * (halfWidth + 2) * Math.sign(bend), w: 2.4, h: 3.2, angle: bend, id: i });
    }
    // A single stylised opera-house landmark is anchored to its real OSM
    // footprint when it falls beside this route. It is not an exact replica.
    const theatre = (this.data.geo?.buildings || []).find(b => /nhà hát|theatre|theater/i.test(b.name || ''));
    if (theatre?.points?.length) {
      const x = theatre.points.reduce((n, p) => n + p[0], 0) / theatre.points.length;
      const y = theatre.points.reduce((n, p) => n + p[1], 0) / theatre.points.length;
      if (nearestDistance(x, y, -100) > halfWidth + 12) props.push({ kind: 'landmark', x, y, w: 47, h: 38, fixedIndex: 5, label: 'Nhà hát thành phố · cách điệu' });
    }
    // The pavilion is an explicitly fictional event café beside a real water edge.
    for (let i = 14; i < samples.length; i += 78) {
      const p = samples[i];
      const waterSide = isWater(p.x + p.nx * (halfWidth + 13), p.y + p.ny * (halfWidth + 13)) ? 1 : isWater(p.x - p.nx * (halfWidth + 13), p.y - p.ny * (halfWidth + 13)) ? -1 : 0;
      if (waterSide) {
        const off = halfWidth + 18;
        props.push({ kind: 'landmark', x: p.x + p.nx * off * waterSide, y: p.y + p.ny * off * waterSide, w: 18, h: 13, fixedIndex: 7, label: 'Góc hẹn ven hồ · kiến trúc hư cấu' });
      }
    }
    // Preserve actual OSM area footprints; cache bounds for distance culling.
    const areas = (this.data.geo?.areas || []).map(a => ({ ...a, minX: Math.min(...a.points.map(p => p[0])), maxX: Math.max(...a.points.map(p => p[0])), minY: Math.min(...a.points.map(p => p[1])), maxY: Math.max(...a.points.map(p => p[1])) }));
    const district=track.district||'center',choices={lake:[4,3],garden:[3,4],oldtown:[5,6],port:[0,1,7],bridge:[2,5],center:[6,4]}[district];
    for(let i=10;i<samples.length;i+=36){const p=samples[i],side=i%2?1:-1,off=halfWidth+20,x=p.x+p.nx*off*side,y=p.y+p.ny*off*side;
      if(!isWater(x,y)&&nearestDistance(x,y,i)>halfWidth+10){for(let j=props.length-1;j>=0;j--)if(props[j].kind==='shop'&&Math.hypot(props[j].x-x,props[j].y-y)<19)props.splice(j,1);props.push({kind:'district',x,y,w:22,h:23,frame:choices[Math.floor(i/36)%choices.length],id:i});}}
    const propGrid=new SpatialGrid(64);for(const prop of props)propGrid.insert(prop);
    const nearby=this.roadGrid.query((track.bounds.minX+track.bounds.maxX)/2,(track.bounds.minY+track.bounds.maxY)/2,Math.max(track.bounds.maxX-track.bounds.minX,track.bounds.maxY-track.bounds.minY)/2+100,[]),traffic=[];
    for(const road of nearby){if(traffic.length>=6)break;const len=Math.hypot(road.b[0]-road.a[0],road.b[1]-road.a[1]);if(len>24&&nearestDistance(road.x,road.y,-100)>halfWidth+18&&nearestDistance(...road.a,-100)>halfWidth+13&&nearestDistance(...road.b,-100)>halfWidth+13)traffic.push(road);}
    const out = { samples, props, propGrid,traffic, halfWidth, areas, track };
    this.routeCache.set(key, out); return out;
  }

  project(x, y, h = 0) {
    const c = this.camera, dx = x - c.x, dy = y - c.y;
    const z = dx * c.cos + dy * c.sin + c.back;
    const right = -dx * c.sin + dy * c.cos;
    if (z < .7) return null;
    const scale = c.focal / z;
    return { x: this.width * .5 + right * scale, y: c.horizon + (c.height - h) * scale, scale, z };
  }

  projectPoly(points, height = 0) {
    const c = this.camera, inpts = points.map(p => {
      const a = xy(p), dx = a[0] - c.x, dy = a[1] - c.y;
      return { right: -dx * c.sin + dy * c.cos, z: dx * c.cos + dy * c.sin + c.back };
    });
    const clipped = [];
    for (let i = 0; i < inpts.length; i++) {
      const a = inpts[i], b = inpts[(i + 1) % inpts.length], near = 1;
      if (a.z >= near) clipped.push(a);
      if ((a.z >= near) !== (b.z >= near)) {
        const t = (near - a.z) / (b.z - a.z); clipped.push({ right: lerp(a.right, b.right, t), z: near });
      }
    }
    return clipped.map(p => [this.width * .5 + p.right * c.focal / p.z, c.horizon + (c.height - height) * c.focal / p.z]);
  }

  groundPoly(points, fill, stroke = null, width = 1) {
    const projected = this.projectPoly(points);
    if (projected.length < 3) return;
    polygon(this.ctx, projected, fill, stroke, width);
  }

  render(state = {}, dt = 1 / 60) {
    const began = performance.now();
    this.time += Math.min(dt || 0, .1);
    this.quality = normalizeQuality(state.config?.quality || this.quality); this.resize();
    const ctx = this.ctx, W = this.width, H = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const track = state.track || this.data.tracks?.[state.config?.track || 0] || this.data.geo?.routes?.[0];
    const scene = this.prepareTrack(track);
    if (!scene?.samples.length) { ctx.fillStyle = '#a4c8ca'; ctx.fillRect(0, 0, W, H); return; }
    const first = scene.samples[0];
    const p = state.player || { x: first.x, y: first.y, heading: first.heading, speed: 0 };
    const menu = state.phase === 'menu' || !state.player;
    const cm = Number(state.cameraMode || 0) % 3;
    const camHeading = (Number.isFinite(p.heading) ? p.heading : first.heading)+(state.cinematic?.azimuth||0);
    if (!this.camera || this._lastTrack !== track.name || this._lastPhase === 'menu' && !menu) this.camera = { heading: camHeading };
    this._lastTrack = track.name; this._lastPhase = state.phase;
    const smooth = 1 - Math.exp(-Math.min(dt || .016, .1) * (menu ? 2 : 7));
    this.camera.heading += angleDelta(camHeading, this.camera.heading) * smooth;
    const boost=p.nitroActive?1:0,braking=p.weightTransfer||0;
    const back = (cm === 1 ? 31 : cm === 2 ? 9 : 18)+boost*2+braking*3;
    const height = (cm === 1 ? 18 : cm === 2 ? 5 : 9)+braking*2;
    Object.assign(this.camera, { x: p.x, y: p.y, cos: Math.cos(this.camera.heading), sin: Math.sin(this.camera.heading), back, height, focal: H * (cm === 1 ? 1.01 : .97)*(1-boost*.055), horizon: H * (cm === 1 ? .25 : .31) });
    const env = state.environment || { time: 'day', weather: 'clear' };
    const theme = THEMES[env.time] || THEMES.day;
    const weather = env.weather || 'clear';
    this._theme = theme; this._env = env;
    this._maxDistance = (this.quality === 'performance' ? 210 : this.quality === 'ultra' ? 420 : 290)*Math.max(.8,this.detail);
    const shake=(state.config?.cameraShake??.45)*(p.hitTimer>1?Math.min(1,(p.hitTimer-1)*4):0);ctx.translate(Math.sin(this.time*79)*shake*2,Math.cos(this.time*61)*shake);
    this.drawSky(theme, env, menu);
    ctx.fillStyle = theme.ground; ctx.fillRect(0, this.camera.horizon, W, H - this.camera.horizon);
    this.drawAreas(scene, theme, p);
    this.drawContextRoads(scene, theme, p);
    this.drawTrack(scene, theme, p);
    this.drawObjects(scene, state, theme, p);this.drawSkills(state,dt);
    if (env.time !== 'day') {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = env.time === 'night' ? '#9eb4d8' : '#ffe2c7'; ctx.globalAlpha = env.time === 'night' ? .24 : .13; ctx.fillRect(0, this.camera.horizon, W, H); ctx.restore();
    }
    this.drawWeather(weather, env.time, p);
    // Gentle edge shade keeps the road readable without overwhelming bloom.
    const vignette = ctx.createLinearGradient(0, 0, W, 0);
    vignette.addColorStop(0, '#1c40591a'); vignette.addColorStop(.18, '#1c405900'); vignette.addColorStop(.82, '#1c405900'); vignette.addColorStop(1, '#1c40591a');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    const wallDelta = this._lastFrameAt ? Math.min(1, (began - this._lastFrameAt) / 1000) : 0;
    this._lastFrameAt = began; this._fpsTime += wallDelta; this._fpsFrames++;
    if (this._fpsTime >= .5) { this.stats.fps = this._fpsFrames / this._fpsTime; this._fpsTime = 0; this._fpsFrames = 0; }
    this.stats.frameMs = performance.now() - began; this.stats.quality = this.quality;
  }

  drawSky(theme, env, menu) {
    const g = this.ctx, W = this.width, H = this.height, horizon = this.camera.horizon;
    const sky = g.createLinearGradient(0, 0, 0, horizon + 50); sky.addColorStop(0, theme.skyTop); sky.addColorStop(1, theme.skyBottom); g.fillStyle = sky; g.fillRect(0, 0, W, horizon + 50);
    // Atmospheric painted layers: far harbour cranes, trees and city roofs.
    const drift = this.camera.heading * W * .12;
    for (let l = 0; l < 3; l++) {
      const y = horizon + 7 - l * 9, size = 28 + l * 7;
      g.fillStyle = env.time === 'night' ? ['#3f6577', '#426a80', '#496d83'][l] : env.time === 'sunset' ? ['#a9b2b2', '#b8bcbc', '#d0c5b6'][l] : ['#91b5b2', '#a5c3bb', '#c0d2c3'][l];
      for (let i = -2; i < Math.ceil(W / size) + 3; i++) {
        const x = ((i * size - drift * (.5 + l * .15)) % (W + size * 4) + W + size * 4) % (W + size * 4) - size * 2;
        const bh = 18 + hash(i * 8 + l * 50) * (48 - l * 9);
        g.fillRect(x, y - bh, size - 2, bh + 5);
        polygon(g, [[x - 2, y - bh], [x + size * .5, y - bh - 9], [x + size, y - bh]], g.fillStyle);
        if (l === 0 && i % 4 === 0) { g.strokeStyle = g.fillStyle; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 10, y - 5); g.lineTo(x + 10, y - 70); g.lineTo(x + 43, y - 79); g.lineTo(x + 32, y - 56); g.stroke(); }
      }
    }
    if (env.time === 'night') {
      g.fillStyle = '#fff2c7'; g.beginPath(); g.arc(W * .78, H * .12, 19, 0, TAU); g.fill();
      g.fillStyle = '#c4dfef'; for (let i = 0; i < 38; i++) { const x = hash(i + 2) * W, y = hash(i + 40) * horizon * .76; g.globalAlpha = .4 + Math.sin(this.time * .5 + i) * .2; g.fillRect(x, y, 1.5, 1.5); } g.globalAlpha = 1;
    } else {
      const sx = W * .78, sy = horizon * .4, sun = g.createRadialGradient(sx, sy, 8, sx, sy, 90); sun.addColorStop(0, env.time === 'sunset' ? '#ffe3b4dd' : '#fff6dacc'); sun.addColorStop(1, '#fff6da00'); g.fillStyle = sun; g.fillRect(sx - 100, sy - 100, 200, 200);
      for (const cloud of this.clouds) {
        const x = (cloud.x * W + this.time * 2 - drift * .12 + W * 2) % (W * 1.4) - W * .2, y = cloud.y * H;
        g.fillStyle = env.time === 'sunset' ? '#fff0d2bb' : '#fbf9dfbb'; g.beginPath();
        g.ellipse(x, y, cloud.w * .5, cloud.w * .08, 0, 0, TAU); g.ellipse(x - cloud.w * .2, y - cloud.w * .05, cloud.w * .25, cloud.w * .14, 0, 0, TAU); g.ellipse(x + cloud.w * .13, y - cloud.w * .07, cloud.w * .24, cloud.w * .17, 0, 0, TAU); g.fill();
      }
      // A pair of distant birds gives the harbour skyline a little movement.
      if (this.quality !== 'performance') { g.strokeStyle = '#617e86aa'; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const x = (W * .6 + this.time * 7 + i * 24) % W, y = H * .16 + Math.sin(this.time * .6 + i) * 7; g.beginPath(); g.moveTo(x - 5, y); g.quadraticCurveTo(x - 2, y - 4, x, y); g.quadraticCurveTo(x + 2, y - 4, x + 5, y); g.stroke(); } }
    }
    const backdrop = this.findAsset(['background', 'panorama', 'city.panorama', 'city.background']);
    if (backdrop) {
      g.save(); g.globalAlpha = .65; const ratio = backdrop.image.width / backdrop.image.height, h = horizon * .75, w = h * ratio;
      g.drawImage(backdrop.image, W * .5 - w * .5, horizon - h + 20, w, h); g.restore();
    }
  }

  drawAreas(scene, theme, player) {
    const g = this.ctx, reach = this._maxDistance * 1.6;
    for (const a of scene.areas) {
      if (player.x < a.minX - reach || player.x > a.maxX + reach || player.y < a.minY - reach || player.y > a.maxY + reach) continue;
      const isWater = a.type === 'water';
      this.groundPoly(a.points, isWater ? theme.water : theme.park);
      if (isWater) {
        const pp = this.projectPoly(a.points); if (pp.length < 3) continue;
        g.save(); polygon(g, pp, null, theme.waterEdge, 3); g.clip();
        // Wavelets are spatially stable and never draw on the race surface.
        g.strokeStyle = envNight(this._env) ? '#b7d7de33' : '#e5f3d65c'; g.lineWidth = 1.5;
        const top = Math.max(this.camera.horizon, Math.min(...pp.map(p => p[1]))), bottom = Math.min(this.height, Math.max(...pp.map(p => p[1])));
        for (let y = top; y < bottom; y += 13) { for (let x = (Math.sin(y * .4) * 25 + this.time * 3) % 45 - 45; x < this.width; x += 63) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 17 + Math.sin(y) * 7, y); g.stroke(); } }
        g.restore();
      }
      for (const hole of a.holes || []) this.groundPoly(hole, theme.ground);
    }
  }

  drawContextRoads(scene,theme,player){
    for(const r of this.roadGrid.query(player.x,player.y,this._maxDistance+35,this._nearRoads)){
      const a=r.a,b=r.b,len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/len,ny=(b[0]-a[0])/len,half=Math.min(r.width||7,12)*.5;
      this.groundPoly([[a[0]+nx*(half+2),a[1]+ny*(half+2)],[b[0]+nx*(half+2),b[1]+ny*(half+2)],[b[0]-nx*(half+2),b[1]-ny*(half+2)],[a[0]-nx*(half+2),a[1]-ny*(half+2)]],theme.pavement);
      this.groundPoly([[a[0]+nx*half,a[1]+ny*half],[b[0]+nx*half,b[1]+ny*half],[b[0]-nx*half,b[1]-ny*half],[a[0]-nx*half,a[1]-ny*half]],theme.roadEdge);
    }
    for(const branch of scene.track.shortcuts||[]){
      for(let i=1;i<branch.points.length;i++){const a=branch.points[i-1],b=branch.points[i];if(Math.hypot(a[0]-player.x,a[1]-player.y)>this._maxDistance+50)continue;const len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/len,ny=(b[0]-a[0])/len,w=branch.halfWidth;
       this.groundPoly([[a[0]+nx*w,a[1]+ny*w],[b[0]+nx*w,b[1]+ny*w],[b[0]-nx*w,b[1]-ny*w],[a[0]-nx*w,a[1]-ny*w]],theme.road,'#e5c777',1.5);}
    }
  }

  drawTrack(scene, theme, player) {
    const g = this.ctx, ss = scene.samples, width = scene.halfWidth;
    const segments = [];
    for (let i = 0; i < ss.length; i++) {
      const a = ss[i], b = ss[(i + 1) % ss.length], midX = (a.x + b.x) * .5, midY = (a.y + b.y) * .5;
      const dx = midX - player.x, dy = midY - player.y;
      if (dx * dx + dy * dy > this._maxDistance ** 2) continue;
      const z = dx * this.camera.cos + dy * this.camera.sin + this.camera.back;
      if (z < -15) continue;
      segments.push({ a, b, z, i });
    }
    segments.sort((a, b) => b.z - a.z);
    const ribbon = (a, b, lo, hi, fill) => this.groundPoly([[a.x + a.nx * lo, a.y + a.ny * lo], [b.x + b.nx * lo, b.y + b.ny * lo], [b.x + b.nx * hi, b.y + b.ny * hi], [a.x + a.nx * hi, a.y + a.ny * hi]], fill);
    // Full sidewalk bed precedes the entire asphalt surface, including at bends.
    for (const { a, b } of segments) ribbon(a, b, -width - 5, width + 5, theme.pavement);
    for (const { a, b } of segments) ribbon(a, b, -width, width, theme.road);
    for (const { a, b, z, i } of segments) {
      // Single continuous boundaries, alternating curb segments and lane dashes.
      for (const side of [-1, 1]) {
        ribbon(a, b, side * width, side * (width + .4), i % 4 < 2 ? '#eee9cd' : '#ca7d6a');
        ribbon(a, b, side * (width - .42), side * (width - .30), '#e5dec1');
        if (z < 120 && this.quality !== 'performance') {
          ribbon(a, b, side * (width + 3), side * (width + 3.05), '#9eac9660');
          const pa = this.project(a.x + a.nx * (width + 4) * side, a.y + a.ny * (width + 4) * side);
          const pb = this.project(a.x + a.nx * (width + .6) * side, a.y + a.ny * (width + .6) * side);
          if (pa && pb) { g.strokeStyle = '#89988a50'; g.lineWidth = .6; g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke(); }
        }
      }
      if (i % 3 !== 2) ribbon(a, b, -.055, .055, '#ded7b3');
      // Fair, visible racing line is painted navigation, never steering assist.
      if (i % 7 === 0) {
        const mid = { x: lerp(a.x, b.x, .5), y: lerp(a.y, b.y, .5) }, h = a.heading, length = 2.6, w = .65;
        const arrow = [[mid.x + Math.cos(h) * length, mid.y + Math.sin(h) * length], [mid.x - Math.cos(h) * .6 + a.nx * w, mid.y - Math.sin(h) * .6 + a.ny * w], [mid.x - Math.cos(h) * .1, mid.y - Math.sin(h) * .1], [mid.x - Math.cos(h) * .6 - a.nx * w, mid.y - Math.sin(h) * .6 - a.ny * w]];
        this.groundPoly(arrow, envNight(this._env) ? '#8ce0c780' : '#d4e2bd99');
      }
      // Tiny repaired patches, drain covers and tire marks reward close viewing.
      if (z < 75 && i % 11 === 3 && this.quality !== 'performance') {
        const off = width * .62;
        ribbon(a, { ...b, x: lerp(a.x, b.x, .3), y: lerp(a.y, b.y, .3) }, off - .32, off + .32, envNight(this._env) ? '#2b4559' : '#536570');
      }
    }
    // Physical checkerboard start line, correctly placed across the road.
    const start = ss[0], h = start.heading, nx = start.nx, ny = start.ny;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 16; col++) {
      const lo = -width + col * width / 8, hi = lo + width / 8, f1 = row * .6 - .6, f2 = f1 + .6;
      this.groundPoly([[start.x + nx * lo + Math.cos(h) * f1, start.y + ny * lo + Math.sin(h) * f1], [start.x + nx * hi + Math.cos(h) * f1, start.y + ny * hi + Math.sin(h) * f1], [start.x + nx * hi + Math.cos(h) * f2, start.y + ny * hi + Math.sin(h) * f2], [start.x + nx * lo + Math.cos(h) * f2, start.y + ny * lo + Math.sin(h) * f2]], (col + row) % 2 ? '#eae6d1' : '#334b58');
    }
    if (this._env.weather === 'rain') {
      g.save(); g.globalAlpha = .12;
      for (const { a, b, i } of segments) if (i % 4 === 0) ribbon(a, b, width * -.8, width * -.3, '#c4dce3');
      g.restore();
    }
  }

  findAsset(keys) {
    for (const key of keys) if (this.assets[key]) return this.assets[key];
    return null;
  }

  atlasFrame(asset, column = 0, row = 0) {
    const cols = asset.columns || asset.cols || 1, rows = asset.rows || 1;
    if (Number.isInteger(asset.fixedIndex)) { column = asset.fixedIndex % cols; row = Math.floor(asset.fixedIndex / cols); }
    const sw = asset.image.width / cols, sh = asset.image.height / rows;
    const idx = row * cols + column;
    if (asset.frames && Array.isArray(asset.frames)) {
      const f = asset.frames[idx % asset.frames.length];
      if (f && typeof f === 'object') return { sx: f.x || 0, sy: f.y || 0, sw: f.w || f.width || sw, sh: f.h || f.height || sh };
    }
    return { sx: (column % cols) * sw, sy: (row % rows) * sh, sw, sh };
  }

  drawSprite(image,x,y,w,h,opacity=1,frame=null,lean=0,anchor=.94){
    if(w<.6||h<.6||!image)return;
    const g=this.ctx;
    if(frame){let map=this.mipCache.get(image);if(!map){map=new Map();this.mipCache.set(image,map);}const size=w>280?512:w>130?256:w>60?128:64;
      const key=[frame.sx,frame.sy,frame.sw,frame.sh,size].join(',');let tile=map.get(key);if(!tile){tile=canvas(size,Math.max(1,Math.round(size*frame.sh/frame.sw)));tile.getContext('2d').drawImage(image,frame.sx,frame.sy,frame.sw,frame.sh,0,0,tile.width,tile.height);map.set(key,tile);}image=tile;}
    const alpha=g.globalAlpha;if(opacity!==1)g.globalAlpha*=opacity;
    if(Math.abs(lean)>.002&&h>15){g.save();g.translate(x,y);g.rotate(lean);g.drawImage(image,-w*.5,-h*anchor,w,h);g.restore();}
    else g.drawImage(image,x-w*.5,y-h*anchor,w,h);
    if(opacity!==1)g.globalAlpha=alpha;
  }

  drawObjects(scene, state, theme, player) {
    const g = this.ctx, items = this._drawObjects; items.length = 0;
    const add = object => {
      const dx = object.x - player.x, dy = object.y - player.y;
      if (dx * dx + dy * dy > this._maxDistance ** 2) return;
      const p = this.project(object.x, object.y, 0);
      if (!p || p.z < 1.2 || p.z > this._maxDistance) return;
      if (p.x < -p.scale * (object.w || 5) || p.x > this.width + p.scale * (object.w || 5)) return;
      items.push({ object, p });
    };
    for (const prop of scene.propGrid.query(player.x,player.y,this._maxDistance+35,this._nearProps)) {
      if (this.quality === 'performance' && (prop.kind === 'person' && prop.id % 3 || prop.kind === 'bicycle')) continue;
      if(prop.kind==='person'&&prop.id%3===0)add({...prop,x:prop.x+Math.sin(this.time*.5+prop.id)*1.5});else add(prop);
    }
    for (const ob of state.obstacles || []) if (!ob.hit || ob.type === 'barrier') add({ ...ob, kind: 'obstacle', w: ob.type === 'barrier' ? 2.4 : ob.type === 'crate' ? 1.4 : .7, h: ob.type === 'barrier' ? 1.2 : ob.type === 'crate' ? 1.1 : .9 });
    for (const item of state.pickups || []) if (!item.collected) add({ ...item, kind: 'pickup', w: .9, h: 1.1 });
    for (let i = 0; i < (state.checkpoints || []).length; i++) {
      const cp = state.checkpoints[i];
      if (i !== (state.checkpointIndex || 0)) continue;
      if (Number.isFinite(cp.x)) add({ ...cp, kind: 'checkpoint', w: scene.halfWidth * 2, h: 4.5, index: i });
    }
    for(const [i,road] of scene.traffic.entries()){const t=(this.time*(.12+i*.015)+i*.2)%1;add({kind:'rider',x:road.a[0]+(road.b[0]-road.a[0])*t,y:road.a[1]+(road.b[1]-road.a[1])*t,heading:Math.atan2(road.b[1]-road.a[1],road.b[0]-road.a[0]),speed:8,w:1.2,h:2.4,character:['minh','nhi','phong','rin'][i%4],ambient:true});}
    if(state.chase?.active)add({...state.chase,kind:'rider',w:1.25,h:2.4,character:'lucien'});
    for(const b of state.branches||[]){const entry=b.gates[0];add({...entry,kind:'turn',w:3.5,h:3.4,angle:.5,label:'LỐI TẮT'});}
    const start = scene.samples[0]; add({ kind: 'gate', x: start.x, y: start.y, w: scene.halfWidth * 2 + 1, h: 6.5, nx: start.nx, ny: start.ny, id: 0 });
    for (const rival of state.rivals || []) add({ ...rival, kind: 'rider', w: 1.25, h: 2.4, character: rival.id || 'lucien', isPlayer: false });
    if(!state.cinematic?.hideRiders)add({ ...player, kind: 'rider', w: 1.4, h: 2.6, character: 'aurora', isPlayer: true });
    items.sort((a, b) => b.p.z - a.p.z);
    this.stats.visibleObjects = items.length;
    for (const { object: o, p } of items) {
      const distanceOpacity = clamp((this._maxDistance - p.z) / 100, 0, 1);
      if (distanceOpacity <= 0) continue;
      g.save(); g.globalAlpha = distanceOpacity;
      if(o.kind==='district'){
        const asset=this.findAsset(['districts']);if(asset){const frame=this.atlasFrame({...asset,fixedIndex:o.frame});this.shadow(p,o.w*.4,2.5,theme.shadow);this.drawSprite(asset.image,p.x,p.y,p.scale*o.w,p.scale*o.h,1,frame,0,.94);}
      } else if (o.kind === 'shop') {
        const asset = this.findAsset(['buildings', 'city.buildings', 'architecture', 'shops']);
        const w = p.scale * o.w, h = p.scale * (asset ? o.w * 1.1 : o.h);
        this.shadow(p, o.w * .43, 2.2, theme.shadow);
        if (asset) {
          const cols = asset.columns || asset.cols || 1, rows = asset.rows || 1;
          const choices = asset.variants || [0, 1, 2, 3, 6].filter(n => n < cols * rows);
          const v = choices[Math.floor(o.variant) % choices.length] ?? 0;
          const frame = this.atlasFrame(asset, v % cols, Math.floor(v / cols));
          if (rows === 2 && v < 4) frame.sh -= 8;
          if (rows === 2 && v >= 4) {frame.sy += 22;frame.sh -= 22;}
          this.drawSprite(asset.image, p.x, p.y, w, h, 1, frame, 0, asset.anchor || .94);
        } else this.drawSprite(this.shops[envNight(this._env) ? 'night' : 'day'][Math.floor(o.variant)], p.x, p.y, w, h, 1, null, 0, .89);
      } else if (o.kind === 'landmark') {
        const asset = this.findAsset(['buildings', 'city.buildings', 'architecture', 'shops']);
        if (asset) {
          const cols = asset.columns || asset.cols || 4, frame = this.atlasFrame({...asset, fixedIndex: o.fixedIndex}, 0, 0);
          this.shadow(p, o.w * .45, 3, theme.shadow);
          this.drawSprite(asset.image, p.x, p.y, p.scale * o.w, p.scale * o.h, 1, frame, 0, .97);
        }
      } else if (o.kind === 'tree') {
        this.shadow(p, o.w * .3, 1.5, theme.shadow);
        const asset = this.findAsset(['trees', 'city.trees', 'environment.trees']);
        if (asset) {
          const frame = this.atlasFrame(asset, o.variant || 0);
          // The source sheet's café foundation overlaps the next row by a few
          // pixels. Keep that neighbouring tile out of the tree frame.
          if (asset.fixedIndex === 4) { frame.sy += 15; frame.sh -= 15; }
          this.drawSprite(asset.image, p.x, p.y, p.scale * o.w, p.scale * o.h, 1, frame, Math.sin(this.time * .6 + o.id) * .007);
        }
        else this.drawSprite(this.trees[o.variant], p.x, p.y, p.scale * o.w, p.scale * o.h, 1, null, Math.sin(this.time * .6 + o.id) * .007);
      } else if (o.kind === 'person') {
        const bob = Math.sin(this.time * 3 + o.id) * .025;
        this.shadow(p, .35, .2, theme.shadow);
        this.drawSprite(this.spectators[o.variant], p.x, p.y, p.scale * o.w, p.scale * (o.h + bob), 1, null, Math.sin(this.time * 2 + o.id) * .014);
      } else if (o.kind === 'lamp') {
        this.drawSprite(this.lamps[envNight(this._env) ? 1 : 0], p.x, p.y, p.scale * o.w, p.scale * o.h);
        if (envNight(this._env) && p.z < 120) {
          const lg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.scale * 2.5); lg.addColorStop(0, '#ffdd8f22'); lg.addColorStop(1, '#ffdd8f00'); g.fillStyle = lg; g.beginPath(); g.ellipse(p.x, p.y, p.scale * 2.5, p.scale * .7, 0, 0, TAU); g.fill();
        }
      } else if (o.kind === 'bench') this.drawSprite(this.bench, p.x, p.y, p.scale * o.w, p.scale * o.h, 1, null, 0, .9);
      else if (o.kind === 'bicycle') this.drawSprite(this.bicycle, p.x, p.y, p.scale * o.w, p.scale * o.h, 1, null, 0, .9);
      else if (o.kind === 'barrier') this.drawBarrier(o, p, scene.halfWidth);
      else if (o.kind === 'turn') this.drawTurnSign(o, p);
      else if (o.kind === 'obstacle') {
        this.shadow(p, o.w * .43, o.w * .23, theme.shadow);
        this.drawSprite(this.obstacleArt[o.type] || this.obstacleArt.cone, p.x, p.y, p.scale * o.w, p.scale * o.h, o.hit ? .5 : 1, null, o.hit ? .55 : 0, .94);
      } else if (o.kind === 'pickup') {
        this.shadow(p, .45, .2, '#c9a45133');
        this.drawSprite(this.pickup, p.x, p.y - p.scale * (.35 + Math.sin(this.time * 3 + (o.id || 0)) * .12), p.scale * o.w, p.scale * o.h, 1, null, Math.sin(this.time * 2) * .07);
      } else if (o.kind === 'gate') this.drawGate(o, scene, 'START / FINISH', '#245e62');
      else if (o.kind === 'checkpoint') this.drawCheckpoint(o, scene, state);
      else if (o.kind === 'rider') this.drawRider(o, p, state, theme);
      g.restore();
    }
  }

  shadow(p, width, height, color) {
    const g = this.ctx; g.fillStyle = color; g.beginPath(); g.ellipse(p.x + p.scale * .15, p.y, p.scale * width, Math.max(.5, p.scale * height * .32), -.1, 0, TAU); g.fill();
  }

  drawBarrier(o, p) {
    const g = this.ctx, half = o.w * .5, dx = Math.cos(o.heading) * half, dy = Math.sin(o.heading) * half;
    const a = this.project(o.x - dx, o.y - dy, .85), b = this.project(o.x + dx, o.y + dy, .85), aa = this.project(o.x - dx, o.y - dy, .15), bb = this.project(o.x + dx, o.y + dy, .15);
    if (!a || !b || !aa || !bb) return;
    polygon(g, [[a.x, a.y], [b.x, b.y], [bb.x, bb.y], [aa.x, aa.y]], o.variant < 3 ? '#e7dfbd' : '#658f8c', '#466875', Math.min(1.5, p.scale * .08));
    if (p.z < 100) {
      g.strokeStyle = o.variant < 3 ? '#6a8c8a' : '#dddfc1'; g.lineWidth = Math.max(.6, p.scale * .035);
      for (let i = 1; i < 4; i++) { const t = i / 4; g.beginPath(); g.moveTo(lerp(a.x, b.x, t), lerp(a.y, b.y, t)); g.lineTo(lerp(aa.x, bb.x, t), lerp(aa.y, bb.y, t)); g.stroke(); }
    }
    if (p.z < 65 && o.id % 8 === 0) {
      const midX = (a.x + b.x) * .5, midY = (a.y + aa.y + b.y + bb.y) * .25;
      g.font = `bold ${clamp(p.scale * .13, 5, 13)}px sans-serif`; g.textAlign = 'center'; g.fillStyle = o.variant < 3 ? '#527875' : '#f3e7ba'; g.fillText('HP • GRAND PRIX', midX, midY + p.scale * .06);
    }
  }

  drawTurnSign(o, p) {
    const g = this.ctx, scale = p.scale;
    g.fillStyle = '#496b72'; g.fillRect(p.x - scale * .045, p.y - scale * 2.6, scale * .09, scale * 2.6);
    rounded(g, p.x - scale * .75, p.y - scale * 3.1, scale * 1.5, scale * 1.45, scale * .08, '#f3d09a', '#8f786b');
    g.strokeStyle = '#45646c'; g.lineWidth = Math.max(1, scale * .1); g.lineCap = 'round';
    const xx = p.x + (o.angle > 0 ? .25 : -.25) * scale, yy = p.y - scale * 2.35;
    g.beginPath(); g.moveTo(xx - Math.sign(o.angle) * scale * .55, yy + scale * .35); g.lineTo(xx - Math.sign(o.angle) * scale * .55, yy - scale * .15); g.lineTo(xx + Math.sign(o.angle) * scale * .2, yy - scale * .15); g.lineTo(xx - Math.sign(o.angle) * scale * .03, yy - scale * .4); g.moveTo(xx + Math.sign(o.angle) * scale * .2, yy - scale * .15); g.lineTo(xx - Math.sign(o.angle) * scale * .03, yy + scale * .1); g.stroke();
    if(o.label&&p.z<70){g.fillStyle='#ffe4a7';g.font=`bold ${clamp(scale*.25,8,18)}px sans-serif`;g.textAlign='center';g.fillText(o.label,p.x,p.y-scale*3.35);}
  }

  drawGate(o, scene, label, color) {
    const g = this.ctx, start = scene.samples[0], nx = o.nx ?? start.nx, ny = o.ny ?? start.ny, half = scene.halfWidth + .6;
    const lb = this.project(o.x + nx * half, o.y + ny * half, 0), rb = this.project(o.x - nx * half, o.y - ny * half, 0), lt = this.project(o.x + nx * half, o.y + ny * half, 5.8), rt = this.project(o.x - nx * half, o.y - ny * half, 5.8);
    if (!lb || !rb || !lt || !rt) return;
    const z = (lb.z + rb.z) / 2; if (z < 7) return;
    g.strokeStyle = color; g.lineWidth = Math.max(2, (lb.scale + rb.scale) * .2); g.lineCap = 'butt'; g.beginPath(); g.moveTo(lb.x, lb.y); g.lineTo(lt.x, lt.y); g.moveTo(rb.x, rb.y); g.lineTo(rt.x, rt.y); g.stroke();
    const h = Math.max(2, (lt.scale + rt.scale) * .46);
    polygon(g, [[lt.x, lt.y], [rt.x, rt.y], [rt.x, rt.y + h], [lt.x, lt.y + h]], color, '#e9dfba', 1);
    const midx = (lt.x + rt.x) * .5, midy = (lt.y + rt.y) * .5;
    g.save(); g.translate(midx, midy + h * .6); g.rotate(Math.atan2(rt.y - lt.y, rt.x - lt.x) + (rt.x < lt.x ? Math.PI : 0));
    g.fillStyle = '#fff0d0'; g.font = `bold ${clamp(h * .57, 5, 30)}px sans-serif`; g.textAlign = 'center'; g.fillText(label, 0, 0, Math.abs(rt.x - lt.x) * .8); g.restore();
    // Festive pennants, not obstacles, along the inner edge of the gate.
    for (let i = 1; i < 15; i++) {
      const t = i / 15, x = lerp(lt.x, rt.x, t), y = lerp(lt.y, rt.y, t) + h;
      polygon(g, [[x - h * .12, y], [x + h * .12, y], [x, y + h * .33]], i % 3 === 0 ? '#e39d89' : i % 3 === 1 ? '#e7d4a2' : '#94b6a1');
    }
  }

  drawCheckpoint(o, scene) {
    const g = this.ctx, p = this.project(o.x, o.y);
    if (!p || p.z < 3) return;
    let nearest = scene.samples[0], dist = Infinity;
    for (const s of scene.samples) { const d = (s.x - o.x) ** 2 + (s.y - o.y) ** 2; if (d < dist) { dist = d; nearest = s; } }
    const nx = nearest.nx, ny = nearest.ny, half = scene.halfWidth - .8;
    const a = this.project(o.x + nx * half, o.y + ny * half), b = this.project(o.x - nx * half, o.y - ny * half);
    if (!a || !b) return;
    g.strokeStyle = '#b6e6c9aa'; g.lineWidth = Math.max(1, p.scale * .3); g.setLineDash([p.scale * .5, p.scale * .3]); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]);
    for (const side of [-1, 1]) {
      const q = this.project(o.x + nx * (half + .4) * side, o.y + ny * (half + .4) * side), top = this.project(o.x + nx * (half + .4) * side, o.y + ny * (half + .4) * side, 3);
      if (!q || !top) continue;
      g.strokeStyle = '#779a8d'; g.lineWidth = Math.max(1, p.scale * .08); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(top.x, top.y); g.stroke();
      polygon(g, [[top.x, top.y], [top.x + p.scale * .85, top.y + p.scale * .15], [top.x + p.scale * .85, top.y + p.scale * 1.2], [top.x, top.y + p.scale]], '#6eac9a', '#d4edc9', 1);
    }
    if (p.z < 125) { g.font = `bold ${clamp(p.scale * .3, 9, 22)}px sans-serif`; g.fillStyle = '#e7f0cd'; g.textAlign = 'center'; g.fillText('CHECKPOINT', p.x, p.y - p.scale * 2.5); }
  }

  cosmeticRider(asset,col,row,cosmetics){
    const selected=cosmetics||{},key=[row,col,...['paint','helmet','jacket','gloves','accessory'].map(k=>selected[k])].join(':');
    if(!this.cosmeticCache)this.cosmeticCache=new Map();if(this.cosmeticCache.has(key))return this.cosmeticCache.get(key);
    const f=this.atlasFrame(asset,col,row),tile=canvas(320,320*f.sh/f.sw),g=tile.getContext('2d');g.drawImage(asset.image,f.sx,f.sy,f.sw,f.sh,0,0,tile.width,tile.height);
    const palettes={coral:[222,111,91],ocean:[53,134,167],mint:[133,188,160],gold:[214,175,82],navy:[53,74,106],olive:[114,127,79],cream:[231,221,185],teal:[66,146,141]};
    const paint=palettes[selected.paint],jacket=palettes[selected.jacket],gloves=palettes[selected.gloves];
    if(paint||jacket||gloves||selected.accessory==='ribbon'){
      const data=g.getImageData(0,0,tile.width,tile.height),px=data.data;
      for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++){
        const i=(y*tile.width+x)*4;if(px[i+3]<50)continue;const r=px[i],green=px[i+1],b=px[i+2],v=Math.max(r,green,b),lo=Math.min(r,green,b),u=x/tile.width,z=y/tile.height;let color=null;
        const bikeMask=row===0?b>r*1.22&&b>green*1.06:row===1?green>r*1.1&&green>b*1.2:row===2?green>r*1.04&&green>b*1.01:r>green*1.4&&r>b*1.25;
        if(paint&&z>.38&&bikeMask)color=paint;
        if(jacket&&z>.22&&z<.53&&u>.22&&u<.88&&b>r*.99&&b>green*.97&&v<120)color=jacket;
        if(gloves&&z>.32&&z<.48&&(u<.34||u>.77)&&v<65)color=gloves;
        if(selected.accessory==='ribbon'&&z<.21&&u>.3&&u<.7&&v>175&&v-lo<65)color=palettes.coral;
        if(color){const light=Math.max(.18,(r*.21+green*.72+b*.07)/145);px[i]=Math.min(255,color[0]*light);px[i+1]=Math.min(255,color[1]*light);px[i+2]=Math.min(255,color[2]*light);}
      }
      g.putImageData(data,0,0);
    }
    if(selected.helmet&&selected.helmet!=='classic'){
      // Painted open-face helmet shell leaves the long hair and facial features visible.
      const c=palettes[selected.helmet]||palettes.cream,cx=col===0?160:col===3?242:col===1?226:104,cy=col===0?28:30;
      const gradient=g.createLinearGradient(cx-27,cy-20,cx+25,cy+20);gradient.addColorStop(0,`rgb(${c.map(v=>Math.min(255,v+25))})`);gradient.addColorStop(.6,`rgb(${c})`);gradient.addColorStop(1,`rgb(${c.map(v=>v*.65)})`);
      g.fillStyle=gradient;g.strokeStyle='#494f4b';g.lineWidth=1.3;g.beginPath();g.ellipse(cx,cy,26,23,-.12,Math.PI,Math.PI*2);g.lineTo(cx+24,cy+7);g.quadraticCurveTo(cx,cy-3,cx-25,cy+7);g.closePath();g.fill();g.stroke();g.strokeStyle='#f5edd6aa';g.beginPath();g.ellipse(cx-2,cy-6,19,11,0,Math.PI*1.05,Math.PI*1.8);g.stroke();
    }
    if(selected.accessory==='heart'){
      const x=col===0?174:col===3?247:col===1?239:117,y=col===0?32:35;g.fillStyle='#edb264';g.strokeStyle='#8f6742';g.lineWidth=.8;g.beginPath();g.moveTo(x,y+4);g.bezierCurveTo(x-13,y-3,x-6,y-10,x,y-5);g.bezierCurveTo(x+6,y-10,x+13,y-3,x,y+4);g.fill();g.stroke();
    }
    if(this.cosmeticCache.size>=12)this.cosmeticCache.delete(this.cosmeticCache.keys().next().value);this.cosmeticCache.set(key,tile);return tile;
  }

  drawRider(o, p, state, theme) {
    const g = this.ctx;
    const id = ['aurora','lucien','minh','nhi','phong','rin'].includes(o.character) ? o.character : 'lucien';
    const asset = (o.isPlayer&&state.cinematic?.duo&&this.findAsset(['duo'])) || (o.isPlayer && this.findAsset(['riders.vehicles'])) || this.findAsset([`riders.${id}`, `sprites.${id}`, `${id}.riding`, `riding.${id}`, `characters.${id}.riding`, `rider_${id}`, 'riders']);
    this.shadow(p, .65, .55, theme.shadow);
    const speed = o.speed || 0, lean = clamp((o.lean || o.steer || 0) * .22, -.24, .24);
    const bob = Math.sin(this.time * (8 + speed * .1)) * Math.min(.02, speed * .001);
    if (asset) {
      const columns = asset.columns || asset.cols || 1, rows = asset.rows || 1;
      // Three columns are coherent lean states, rather than unrelated poses.
      let col = 0, row = 0;
      if (columns === 3) col = lean < -.025 ? 0 : lean > .025 ? 2 : 1;
      else if (columns >= 4) {
        const relative = angleDelta(o.heading || this.camera.heading, this.camera.heading);
        col = Math.abs(relative) > Math.PI * .6 ? 3 : lean < -.025 ? 1 : lean > .025 ? 2 : 0;
      }
      row = o.isPlayer && this.assets['riders.vehicles'] === asset ? (state.config?.vehicle || 0) : (asset.row ?? 0);
      if (asset.animatedRows && rows > 1) row = speed > .6 ? Math.floor(this.time * 6) % rows : 0;
      if(o.isPlayer&&state.cinematic?.duo){col=state.cinematic.view==='side'?1:state.cinematic.view==='front'?2:0;row=0;}
      const frame = this.atlasFrame(asset, col, row);
      const aspect = asset.aspect || frame.sw / frame.sh;
      const worldHeight = asset.worldHeight || (state.cinematic?.duo&&o.isPlayer?3.2:2.75), h = p.scale * worldHeight, w = h * aspect;
      if(o.isPlayer&&!state.cinematic?.duo&&Object.entries(state.cosmetics||{}).some(([k,v])=>v!==({paint:'original',helmet:'classic',jacket:'original',gloves:'black',accessory:'daisies'})[k]))this.drawSprite(this.cosmeticRider(asset,col,row,state.cosmetics),p.x,p.y+bob*p.scale,w,h,1,null,lean,asset.anchor||.96);
      else this.drawSprite(asset.image, p.x, p.y + bob * p.scale, w, h, 1, frame, lean, asset.anchor || .96);
      if(speed>2){
        // A restrained moving spoke highlight animates the painted wheels without
        // replacing the illustrated tyres or changing their contact with the road.
        const side=state.cinematic?.duo&&state.cinematic.view==='side'||col===1||col===2;
        const rotation=o.wheelRotation??this.time*speed/.335;
        g.save();g.translate(p.x,p.y+bob*p.scale);g.rotate(lean);g.strokeStyle='#d8e0cf55';g.lineWidth=Math.max(.5,p.scale*.012);
        for(const xx of side?[-w*.29,w*.29]:[0]){const yy=side?-h*.12:-h*.11,rx=side?w*.07:w*.022,ry=h*.065;for(let i=0;i<2;i++){const a=rotation+i*Math.PI/2;g.beginPath();g.moveTo(xx-Math.cos(a)*rx,yy-Math.sin(a)*ry);g.lineTo(xx+Math.cos(a)*rx,yy+Math.sin(a)*ry);g.stroke();}}g.restore();
      }
      // Visible brake and headlight glows remain subordinate to painted art.
      if (o.isPlayer && state.player?.brake > .1) { g.fillStyle = '#f98674'; g.shadowColor = '#ee6c61'; g.shadowBlur = 9; g.beginPath(); g.ellipse(p.x, p.y - h * .24, w * .07, h * .02, lean, 0, TAU); g.fill(); g.shadowBlur = 0; }
    } else {
      // Until generated art is loaded, use preserved V7 portrait on a detailed
      // illustrated bike, never a head made out of primitive 3D geometry.
      this.drawFallbackRider(o, p, state, id, lean);
    }
    if (!o.isPlayer && !o.ambient && p.z < 100) {
      const name = displayName({characterNames:state.characterNames},o.character||'lucien');
      g.font = `600 ${clamp(p.scale * .18, 9, 13)}px sans-serif`; g.textAlign = 'center';
      const labelWidth = g.measureText(name).width + 18;
      rounded(g, p.x - labelWidth * .5, p.y - p.scale * 3.25, labelWidth, 19, 7, '#1e4b58ce', '#d8dfc159');
      g.fillStyle = '#f4e9cf'; g.fillText(name[0].toUpperCase() + name.slice(1), p.x, p.y - p.scale * 3.25 + 13);
    }
    // Speed-linked, short hair/cloth streaks are extremely restrained.
    if (o.isPlayer && speed > 25 && this.quality !== 'performance') {
      g.save(); g.strokeStyle = '#e6edda66'; g.lineWidth = 1.5;
      for (const side of [-1, 1]) { g.beginPath(); g.moveTo(p.x + p.scale * .5 * side, p.y - p.scale * .45); g.lineTo(p.x + p.scale * .7 * side, p.y + p.scale * .35); g.stroke(); }
      g.restore();
    }
  }

  drawSkills(state,dt){
    const p=state.player,g=this.ctx;if(!p)return;this.particleClock+=dt;
    if((p.drifting||p.nitroActive)&&this.particleClock>.06){this.particleClock=0;const item=this.particles[this.particleCursor++%this.particles.length];Object.assign(item,{x:p.x-Math.cos(p.heading)*1.2,y:p.y-Math.sin(p.heading)*1.2,life:p.drifting?.6:.32,max:p.drifting?.6:.32,kind:p.drifting?'smoke':'nitro',r:.25});}
    for(const q of this.particles){if(q.life<=0)continue;q.life-=dt;q.r+=dt*.8;const v=this.project(q.x,q.y,.15);if(!v)continue;g.globalAlpha=Math.max(0,q.life/q.max)*.4;g.fillStyle=q.kind==='nitro'?'#a4f1e8':state.environment?.weather==='rain'?'#c4dce4':'#dbc7ac';g.beginPath();g.ellipse(v.x,v.y,Math.max(1,v.scale*q.r),Math.max(1,v.scale*q.r*.35),0,0,TAU);g.fill();}g.globalAlpha=1;
  }

  drawFallbackRider(o, p, state, id, lean) {
    const g = this.ctx, s = p.scale, color = ['#497e9a', '#71a077', '#a4c2b4', '#bd7369'][state.config?.vehicle || 0];
    g.save(); g.translate(p.x, p.y); g.rotate(lean);
    g.fillStyle = '#263d50'; g.beginPath(); g.ellipse(0, -.23 * s, .18 * s, .5 * s, 0, 0, TAU); g.fill();
    g.strokeStyle = '#d4d2bb'; g.lineWidth = .04 * s; g.beginPath(); g.ellipse(0, -.23 * s, .13 * s, .36 * s, 0, 0, TAU); g.stroke();
    polygon(g, [[-.37 * s, -.4 * s], [-.29 * s, -1.2 * s], [0, -1.45 * s], [.29 * s, -1.2 * s], [.37 * s, -.4 * s], [0, -.2 * s]], color, '#435c6d', Math.max(1, .025 * s));
    rounded(g, -.22 * s, -.88 * s, .44 * s, .37 * s, .12 * s, '#374752', '#c1c9c3');
    rounded(g, -.17 * s, -.48 * s, .34 * s, .1 * s, .03 * s, '#e28e7c');
    const portrait = this.findAsset([`portraits.${id}`, `characters.${id}.portrait`, `characters.${id}`, id]);
    if (portrait) {
      const h = 1.78 * s, w = h * portrait.image.width / portrait.image.height;
      g.drawImage(portrait.image, -w / 2, -2.35 * s, w, h);
    } else {
      // Deliberately remain unobtrusive if the optional art is unavailable.
      rounded(g, -.28 * s, -2.05 * s, .56 * s, 1.1 * s, .2 * s, id === 'aurora' ? '#687d93' : '#839174', '#435966');
      g.fillStyle = id === 'aurora' ? '#594138' : '#2d3743'; g.beginPath(); g.ellipse(0, -2.15 * s, .29 * s, .35 * s, 0, 0, TAU); g.fill();
    }
    g.restore();
  }

  drawWeather(weather, time, player) {
    const g = this.ctx, W = this.width, H = this.height;
    const mistTop = this.camera.horizon - H * .13;
    const mistBottom = weather === 'fog' ? H * .89 : H * .62;
    const fog = g.createLinearGradient(0, mistTop, 0, mistBottom);
    const haze = (THEMES[time] || THEMES.day).haze;
    fog.addColorStop(0, haze + '00');
    fog.addColorStop(.22, haze + (weather === 'fog' ? 'b0' : '4d'));
    fog.addColorStop(.45, haze + (weather === 'fog' ? '88' : '17'));
    fog.addColorStop(1, haze + '00');
    g.fillStyle = fog; g.fillRect(0, mistTop, W, mistBottom - mistTop);
    if (weather === 'rain') {
      g.fillStyle = '#46768b16'; g.fillRect(0, 0, W, H);
      g.strokeStyle = time === 'night' ? '#c6e6f966' : '#e6f7ef99'; g.lineWidth = 1;
      const n = this.quality === 'low' ? 50 : 110;
      for (let i = 0; i < n; i++) {
        const x = (hash(i * 3) * (W + 130) - this.time * (45 + (player.speed || 0)) + (W + 130) * 100) % (W + 130) - 60;
        const y = (hash(i * 4 + 5) * H + this.time * (350 + hash(i) * 220)) % H, len = 9 + hash(i * 7) * 12;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - len * .28, y + len); g.stroke();
      }
    }
    // Falling flamboyant petals live on sidewalks; they don't become hazards.
    if (this.quality !== 'performance' && time !== 'night' && weather === 'clear') {
      g.fillStyle = '#edb99999';
      for (let i = 0; i < 9; i++) {
        const x = (hash(i * 11) * W + Math.sin(this.time * .3 + i) * 35 + this.time * 12) % W, y = (hash(i * 9) * H + this.time * 17) % H;
        g.beginPath(); g.ellipse(x, y, 3, 1.3, this.time + i, 0, TAU); g.fill();
      }
    }
  }

  drawMap(target, track, player = null) {
    if (!target || !track?.points?.length) return;
    const g = target.getContext('2d'), W = target.width, H = target.height, ps = track.points.map(xy);
    const minX = Math.min(...ps.map(p => p[0])), maxX = Math.max(...ps.map(p => p[0])), minY = Math.min(...ps.map(p => p[1])), maxY = Math.max(...ps.map(p => p[1]));
    const scale = Math.min((W - 32) / Math.max(1, maxX - minX), (H - 30) / Math.max(1, maxY - minY));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const project = p => [W / 2 + (p[0] - cx) * scale, H / 2 + (p[1] - cy) * scale];
    g.clearRect(0, 0, W, H);
    for (const a of this.data.geo?.areas || []) {
      const pts = a.points.map(project);
      polygon(g, pts, a.type === 'water' ? '#b7d5d2' : '#ccd6b7');
    }
    const path = ps.map(project); path.push(path[0]);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#647d82'; g.lineWidth = 6; g.beginPath(); path.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.stroke();
    g.strokeStyle = '#f5e3bc'; g.lineWidth = 3; g.stroke();
    const st = path[0]; g.fillStyle = '#d58f7c'; g.beginPath(); g.arc(st[0], st[1], 4, 0, TAU); g.fill();
    if (player) {
      const [x, y] = project([player.x, player.y]); g.save(); g.translate(x, y); g.rotate(player.heading || 0);
      polygon(g, [[6, 0], [-4, -4], [-2, 0], [-4, 4]], '#2f7774', '#fff5d5', 1.5); g.restore();
    }
  }
}
function envNight(env) { return env?.time === 'night'; }

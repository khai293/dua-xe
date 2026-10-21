// Original race content and OSM geometry retained from the supplied V7.
export const vehicles = [
{id:'r1',name:'Yamaha R1',tag:'SPORT · 6 SỐ',kind:'bike',color:0x3475e2,max:58,acc:7.8,grip:1.06,wheelbase:1.42,desc:'Cảm hứng R1 · Xe thể thao, cần nhả ga trước cua'},
{id:'ninja',name:'Kawasaki Ninja',tag:'SPORT · 6 SỐ',kind:'bike',color:0x6ccf38,max:55,acc:7.4,grip:1.12,wheelbase:1.4,desc:'Cảm hứng Ninja · Cân bằng giữa tốc độ và khả năng ôm cua'},
{id:'vespa',name:'Vespa Primavera',tag:'SCOOTER · CVT',kind:'bike',color:0x8bcbb6,max:29,acc:4.2,grip:.96,wheelbase:1.34,desc:'Cảm hứng Vespa · Ga hiền, tư thế ngồi thẳng, dễ làm quen'},
{id:'ducati',name:'Ducati Panigale',tag:'SPORT · 6 SỐ',kind:'bike',color:0xc92d29,max:60,acc:8.1,grip:1.02,wheelbase:1.46,desc:'Cảm hứng Panigale · Ga mạnh, phanh sớm để giữ quỹ đạo'}];

export const levels = [{name:'Lời chào bên hồ',opponent:'minh',pace:.68,sky:0xcbdfea,tag:'LÀM QUEN',reaction:.3},{name:'Gió qua vườn hoa',opponent:'nhi',pace:.76,sky:0xd5e2e9,tag:'NHỊP CUA',reaction:.23},{name:'Nhịp phố cổ',opponent:'phong',pace:.85,sky:0xc7dce3,tag:'BỨT PHÁ',reaction:.17},{name:'Vòng hồ thử thách',opponent:'rin',pace:.94,sky:0xd8d7e3,tag:'KỸ THUẬT',reaction:.11},{name:'Hẹn gặp Lucien',opponent:'lucien',pace:1.02,sky:0xe9c7bc,tag:'CHUNG KẾT',reaction:.06}];
export const story = [
[['aurora','Chiều nay mình hẹn Lucien bên hồ Tam Bạc. Nhưng trước đó, mình muốn tự chạy một vòng Hải Phòng.'],['lucien','Anh đang chờ em. Cứ đi từ từ thôi, đừng để anh phải chạy tới bế em về đấy!'],['minh','Muốn gặp tay đua giỏi nhất thành phố thì trước tiên, vượt qua tớ đã. Sẵn sàng chưa, Aurora?']],
[['nhi','Lucien vừa nhắn hỏi cậu có chạy cẩn thận không. Người yêu gì mà lo xa thật!'],['aurora','Anh ấy lúc nào cũng thế. Nhưng hôm nay mình sẽ chứng minh là mình tự đua được.'],['nhi','Vậy gặp nhau ở vườn hoa nhé. Qua khúc cua này rồi kể chuyện tình yêu sau!']],
[['phong','Lucien nhờ tôi nhắc: đừng vào cua quá nhanh. Tôi nghĩ cậu ấy đứng ngồi không yên rồi.'],['aurora','Em muốn thắng anh ấy bằng chính tay lái của mình. Anh Phong cứ đua hết sức nhé.'],['phong','Được. Phố cổ có nhiều góc rẽ; bình tĩnh sẽ nhanh hơn hấp tấp.']],
[['rin','Chỉ còn một chặng nữa là gặp người yêu rồi. Có hồi hộp không?'],['aurora','Có. Nhưng càng hồi hộp em càng muốn tới đích.'],['rin','Vậy thắng tớ quanh vòng hồ này đi. Lucien đang đợi cậu ở trận cuối.']],
[['lucien','Cuối cùng cũng tới rồi, cô người yêu thích đua xe của anh. Hôm nay mình hẹn hò hay thi đấu đây?'],['aurora','Cả hai! Nếu em thắng, anh phải đưa em đi ngắm hết những nơi đẹp ở Hải Phòng.'],['lucien','Anh nhận lời. Nhưng nếu em ngã, anh sẽ xông ra bế em đi luôn. Hahaha!'],['aurora','Anh cứ chờ đấy. Lần này em sẽ về trước anh!']]
];

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const modulo = (value, length) => ((value % length) + length) % length;

/** Round only the immediate corner; retain the original OSM alignment and raw points. */
export function prepareTrack(source, index = 0) {
  const rawPoints = source.points.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > .2);
  if (Math.hypot(rawPoints[0][0] - rawPoints.at(-1)[0], rawPoints[0][1] - rawPoints.at(-1)[1]) < .2) rawPoints.pop();
  const rounded = [];
  for (let i = 0; i < rawPoints.length; i++) {
    const a = rawPoints[modulo(i - 1, rawPoints.length)], b = rawPoints[i], c = rawPoints[(i + 1) % rawPoints.length];
    const ab = Math.hypot(a[0] - b[0], a[1] - b[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const trim = Math.min(12, ab * .27, bc * .27);
    const entry = [b[0] + (a[0] - b[0]) * trim / ab, b[1] + (a[1] - b[1]) * trim / ab];
    const exit = [b[0] + (c[0] - b[0]) * trim / bc, b[1] + (c[1] - b[1]) * trim / bc];
    for (let j = 0; j <= 4; j++) {
      const t = j / 4, q = 1 - t;
      rounded.push([q * q * entry[0] + 2 * q * t * b[0] + t * t * exit[0], q * q * entry[1] + 2 * q * t * b[1] + t * t * exit[1]]);
    }
  }
  const points = [], distances = [];
  let length = 0;
  for (let i = 0; i < rounded.length; i++) {
    const a = rounded[i], b = rounded[(i + 1) % rounded.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < .01) continue;
    const steps = Math.max(1, Math.ceil(d / 4));
    for (let j = 0; j < steps; j++) {
      const p = [a[0] + (b[0] - a[0]) * j / steps, a[1] + (b[1] - a[1]) * j / steps];
      if (points.length) length += Math.hypot(p[0] - points.at(-1)[0], p[1] - points.at(-1)[1]);
      points.push(p); distances.push(length);
    }
  }
  length += Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const track = {...source, index, rawPoints, points, distances, length, width: 20, roadWidth: 20, halfWidth: 10,
    bounds: {minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys)}};
  const turns = [];
  for (let d = 25; d < length; d += 12) {
    const before = sampleTrack(track, d - 14), after = sampleTrack(track, d + 14);
    const angle = angleDiff(after.heading, before.heading);
    if (Math.abs(angle) > .45 && (!turns.length || d - turns.at(-1).progress > 32)) {
      turns.push({...sampleTrack(track, d), angle, progress: d, street: source.streetNames?.[turns.length % source.streetNames.length] || 'Đường đua'});
    }
  }
  track.turns = turns;
  return track;
}

export function sampleTrack(track, distance, offset = 0) {
  const progress = modulo(distance, track.length), points = track.points, ds = track.distances;
  let low = 0, high = ds.length - 1;
  while (low < high) {const mid = Math.ceil((low + high) / 2); if (ds[mid] <= progress) low = mid; else high = mid - 1;}
  const i = low, a = points[i], b = points[(i + 1) % points.length];
  const segment = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const t = clamp((progress - ds[i]) / segment, 0, 1), tx = (b[0] - a[0]) / segment, ty = (b[1] - a[1]) / segment;
  return {x: a[0] + (b[0] - a[0]) * t - ty * offset, y: a[1] + (b[1] - a[1]) * t + tx * offset,
    heading: Math.atan2(ty, tx), tx, ty, nx: -ty, ny: tx, progress, index: i};
}

// Cache neighboring track segments once per route. A car normally needs to check
// dozens of segments, not the entire OSM loop at every 120 Hz physics tick.
const segmentGrids = new WeakMap();
function getSegmentGrid(track) {
  let grid = segmentGrids.get(track);
  if (grid) return grid;
  const cell = 48, buckets = new Map(), pts = track.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const loX = Math.floor(Math.min(a[0], b[0]) / cell), hiX = Math.floor(Math.max(a[0], b[0]) / cell);
    const loY = Math.floor(Math.min(a[1], b[1]) / cell), hiY = Math.floor(Math.max(a[1], b[1]) / cell);
    for (let cx = loX; cx <= hiX; cx++) for (let cy = loY; cy <= hiY; cy++) {
      const key = cx + ',' + cy;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(i);
    }
  }
  grid = {cell, buckets};
  segmentGrids.set(track, grid);
  return grid;
}

export function nearestPoint(track, x, y, hint = null) {
  let best = null, bestDistance = Infinity;
  const points = track.points, grid = getSegmentGrid(track);
  const cx = Math.floor(x / grid.cell), cy = Math.floor(y / grid.cell);
  const nearby = new Set();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const index of grid.buckets.get((cx + dx) + ',' + (cy + dy)) || []) nearby.add(index);
  }
  const consider = i => {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], d2 = dx * dx + dy * dy;
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (d2 || 1), 0, 1);
    const px = a[0] + dx * t, py = a[1] + dy * t;
    const distance = Math.hypot(x - px, y - py), len = Math.sqrt(d2) || 1;
    const progress = track.distances[i] + len * t;
    const continuity = hint == null ? 0 : Math.min(modulo(progress - hint, track.length), modulo(hint - progress, track.length));
    const score = distance + (continuity > 100 ? Math.min(8, continuity * .003) : 0);
    if (score < bestDistance) {
      bestDistance = score;
      best = {x: px, y: py, progress, distance, signedDistance: ((x - px) * -dy + (y - py) * dx) / len,
        heading: Math.atan2(dy, dx), tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len, index: i};
    }
  };
  for (const i of nearby) consider(i);
  // Safety net for rescue, teleports, custom maps and positions far off the track.
  // Nearby cells include all segments crossing the surrounding 48 m cells.
  if (!best || best.distance > 24) {
    best = null; bestDistance = Infinity;
    for (let i = 0; i < points.length; i++) consider(i);
  }
  return best;
}

export function createData(geo) {
  return {geo, tracks: geo.routes.map(prepareTrack), levels, vehicles, story};
}

export async function loadData() {
  const response = await fetch(new URL('../assets/haiphong-osm.json', import.meta.url));
  if (!response.ok) throw new Error('Không tải được dữ liệu đường đua Hải Phòng.');
  return createData(await response.json());
}

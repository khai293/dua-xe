// Original race content and OSM geometry retained from the supplied V7.
export const vehicles = [
{id:'r1',name:'Yamaha R1',tag:'SPORT · 6 SỐ',kind:'bike',color:0x3475e2,max:58,acc:7.8,grip:1.06,wheelbase:1.42,desc:'Cảm hứng R1 · Xe thể thao, cần nhả ga trước cua'},
{id:'ninja',name:'Kawasaki Ninja',tag:'SPORT · 6 SỐ',kind:'bike',color:0x6ccf38,max:55,acc:7.4,grip:1.12,wheelbase:1.4,desc:'Cảm hứng Ninja · Cân bằng giữa tốc độ và khả năng ôm cua'},
{id:'vespa',name:'Vespa Primavera',tag:'SCOOTER · CVT',kind:'bike',color:0x8bcbb6,max:29,acc:4.2,grip:.96,wheelbase:1.34,desc:'Cảm hứng Vespa · Ga hiền, tư thế ngồi thẳng, dễ làm quen'},
{id:'ducati',name:'Ducati Panigale',tag:'SPORT · 6 SỐ',kind:'bike',color:0xc92d29,max:60,acc:8.1,grip:1.02,wheelbase:1.46,desc:'Cảm hứng Panigale · Ga mạnh, phanh sớm để giữ quỹ đạo'}];

export const levels = [
{name:'Khởi đầu bên hồ',opponent:'minh',pace:.62,tag:'LÀM QUEN',reaction:.4,time:'day',district:'lake'},
{name:'Gió qua vườn hoa',opponent:'nhi',pace:.74,tag:'DRIFT ĐẦU TIÊN',reaction:.28,time:'day',district:'garden'},
{name:'Thử thách phố cổ',opponent:'phong',pace:.85,tag:'LỐI ĐI BÍ MẬT',reaction:.18,time:'sunset',district:'oldtown'},
{name:'Cuộc đua hoàng hôn',opponent:'rin',pace:.95,tag:'DRIFT & NITRO',reaction:.12,time:'sunset',district:'garden'},
{name:'Đường Đến Tình Yêu',opponent:'lucien',pace:1.02,tag:'LỜI HẸN CUỐI',reaction:.07,time:'night',district:'center'}];
export const story = [
[['aurora','Chiều nay mình hẹn Lucien bên hồ Tam Bạc. Nhưng trước đó, mình muốn tự chạy một vòng Hải Phòng.'],['lucien','Anh đang chờ em. Cứ đi từ từ thôi, đừng để anh phải chạy tới bế em về đấy!'],['minh','Muốn gặp tay đua giỏi nhất thành phố thì trước tiên, vượt qua tớ đã. Sẵn sàng chưa, Aurora?']],
[['nhi','Lucien vừa nhắn hỏi cậu có chạy cẩn thận không. Người yêu gì mà lo xa thật!'],['aurora','Anh ấy lúc nào cũng thế. Nhưng hôm nay mình sẽ chứng minh là mình tự đua được.'],['nhi','Vậy gặp nhau ở vườn hoa nhé. Qua khúc cua này rồi kể chuyện tình yêu sau!']],
[['phong','Lucien nhờ tôi nhắc: đừng vào cua quá nhanh. Tôi nghĩ cậu ấy đứng ngồi không yên rồi.'],['aurora','Em muốn thắng anh ấy bằng chính tay lái của mình. Anh Phong cứ đua hết sức nhé.'],['phong','Được. Phố cổ có nhiều góc rẽ; bình tĩnh sẽ nhanh hơn hấp tấp.']],
[['rin','Chỉ còn một chặng nữa là gặp người yêu rồi. Có hồi hộp không?'],['aurora','Có. Nhưng càng hồi hộp em càng muốn tới đích.'],['rin','Vậy thắng tớ quanh vòng hồ này đi. Lucien đang đợi cậu ở trận cuối.']],
[['lucien','Nếu em thắng anh, anh sẽ có một bất ngờ dành cho em.'],['aurora','Vậy thì anh chuẩn bị thua đi nhé!'],['lucien','Anh nhận lời. Nhưng nếu em ngã, anh sẽ xông ra bế em đi luôn. Hahaha!'],['aurora','Anh cứ chờ đấy. Lần này em sẽ về trước anh!']]
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
  track.district = ['lake','garden','oldtown','garden','center','garden','lake','port','oldtown','bridge'][index];
  // Segment bins avoid scanning thousands of OSM points 120 times per second.
  const cells=new Map(),size=48;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    for(let yy=Math.floor(Math.min(a[1],b[1])/size);yy<=Math.floor(Math.max(a[1],b[1])/size);yy++)
      for(let xx=Math.floor(Math.min(a[0],b[0])/size);xx<=Math.floor(Math.max(a[0],b[0])/size);xx++){
        const key=xx+','+yy;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
      }
  }
  track.segmentGrid={size,cells};
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

export function nearestPoint(track, x, y, hint = null) {
  let best = null, bestDistance = Infinity;
  // A progress hint disambiguates routes passing the same physical intersection twice.
  const points = track.points;
  const candidates=[];
  if(track.segmentGrid){const {size,cells}=track.segmentGrid,cx=Math.floor(x/size),cy=Math.floor(y/size),seen=new Set();
    for(let yy=cy-1;yy<=cy+1;yy++)for(let xx=cx-1;xx<=cx+1;xx++)for(const i of cells.get(xx+','+yy)||[])if(!seen.has(i)){seen.add(i);candidates.push(i);}}
  if(!candidates.length)for(let i=0;i<points.length;i++)candidates.push(i);
  for (const i of candidates) {
    const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], d2 = dx * dx + dy * dy;
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
  }
  return best;
}

export function createData(geo) {
  const tracks=geo.routes.map(prepareTrack);
  const graph=roadGraph(geo.roads);
  for(const index of [2,3,4])tracks[index].shortcuts=findShortcut(tracks[index],graph);
  return {geo, tracks, levels, vehicles, story};
}

export async function loadData() {
  const response = await fetch(new URL('../assets/haiphong-osm.json', import.meta.url));
  if (!response.ok) throw new Error('Không tải được dữ liệu đường đua Hải Phòng.');
  return createData(await response.json());
}

// Existing OSM streets form optional alternate branches. No straight-line cuts through blocks.
function roadGraph(roads){
 const graph=new Map(),key=p=>Math.round(p[0]*10)+','+Math.round(p[1]*10);
 for(const road of roads){if(['footway','path','steps','cycleway','pedestrian'].includes(road.kind))continue;
  for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],ka=key(a),kb=key(b),d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d<.01)continue;
   if(!graph.has(ka))graph.set(ka,{point:a,edges:[]});if(!graph.has(kb))graph.set(kb,{point:b,edges:[]});
   graph.get(ka).edges.push({key:kb,d});graph.get(kb).edges.push({key:ka,d});}}
 return graph;
}
function findShortcut(track,graph){
 const key=p=>Math.round(p[0]*10)+','+Math.round(p[1]*10),anchors=[];
 for(const [k,node] of graph){const p=node.point;if(p[0]<track.bounds.minX-8||p[0]>track.bounds.maxX+8||p[1]<track.bounds.minY-8||p[1]>track.bounds.maxY+8)continue;const n=nearestPoint(track,...p);if(n.distance<Math.min(6,track.halfWidth-.7))anchors.push({k,p,progress:n.progress});}
 anchors.sort((a,b)=>a.progress-b.progress);
 let best=null;
 for(let ii=1;ii<anchors.length-1;ii+=Math.max(1,Math.floor(anchors.length/60))){
  const start=anchors[ii],targets=new Map(anchors.filter(a=>a.progress-start.progress>90&&a.progress-start.progress<1800).map(a=>[a.k,a]));if(!targets.size)continue;
  const dist=new Map([[start.k,0]]),previous=new Map(),queue=[{k:start.k,d:0}];let searched=0;
  while(queue.length&&searched++<3500){queue.sort((a,b)=>b.d-a.d);const u=queue.pop();if(u.d!==dist.get(u.k)||u.d>1400)continue;
   const target=targets.get(u.k);
   if(target&&u.d<(target.progress-start.progress)*.91){const keys=[u.k];while(keys.at(-1)!==start.k&&previous.has(keys.at(-1)))keys.push(previous.get(keys.at(-1)));keys.reverse();const points=keys.map(k=>graph.get(k).point);
    if(points.length>2&&points.some(p=>nearestPoint(track,...p).distance>track.halfWidth+3)){
     const saving=target.progress-start.progress-u.d;if(!best||saving>best.saving){best={id:'shortcut-'+track.index,name:'LỐI TẮT · đường phố OSM',points,entry:start.progress,exit:target.progress,length:u.d,saving};} }
   }
   for(const edge of graph.get(u.k)?.edges||[]){const nd=u.d+edge.d;if(nd<(dist.get(edge.key)??Infinity)){dist.set(edge.key,nd);previous.set(edge.key,u.k);queue.push({k:edge.key,d:nd});}}
  }
  if(best&&best.saving>20)break;
 }
 if(!best)return [];
 const distances=[0];for(let i=1;i<best.points.length;i++)distances.push(distances.at(-1)+Math.hypot(best.points[i][0]-best.points[i-1][0],best.points[i][1]-best.points[i-1][1]));best.distances=distances;best.length=distances.at(-1);best.halfWidth=5.5;
 // Remove shared road before/after the actual detour. Entry gates must sit at a fork,
 // rather than hundreds of metres before it on the common approach.
 let first=null,last=null;
 for(let d=0;d<=best.length;d+=2){const q=sampleBranch(best,d);if(nearestPoint(track,q.x,q.y,best.entry).distance>track.halfWidth+.5){first??=d;last=d;}}
 if(first==null)return [];
 const begin=Math.max(0,first-24),end=Math.min(best.length,last+24),a=sampleBranch(best,begin),b=sampleBranch(best,end);
 const ps=[[a.x,a.y],...best.points.filter((p,i)=>distances[i]>begin&&distances[i]<end),[b.x,b.y]];
 const entry=nearestPoint(track,a.x,a.y,best.entry).progress,exit=nearestPoint(track,b.x,b.y,best.exit).progress;
 const ds=[0];for(let i=1;i<ps.length;i++)ds.push(ds.at(-1)+Math.hypot(ps[i][0]-ps[i-1][0],ps[i][1]-ps[i-1][1]));
 if(exit<=entry||exit-entry<ds.at(-1)+5)return [];
 return [{...best,points:ps,distances:ds,entry,exit,length:ds.at(-1),saving:exit-entry-ds.at(-1)}];
}
export function sampleBranch(branch,distance){
 const d=clamp(distance,0,branch.length),ds=branch.distances,ps=branch.points;let i=0;while(i<ds.length-2&&ds[i+1]<d)i++;
 const a=ps[i],b=ps[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,t=clamp((d-ds[i])/len,0,1),tx=(b[0]-a[0])/len,ty=(b[1]-a[1])/len;
 return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,tx,ty,nx:-ty,ny:tx,heading:Math.atan2(ty,tx),progress:d};
}
export function nearestBranch(branch,x,y){
 let best=null;
 for(let i=1;i<branch.points.length;i++){const a=branch.points[i-1],b=branch.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(len*len),0,1),px=a[0]+dx*t,py=a[1]+dy*t,distance=Math.hypot(x-px,y-py);
 if(!best||distance<best.distance)best={x:px,y:py,distance,signedDistance:((x-px)*-dy+(y-py)*dx)/len,heading:Math.atan2(dy,dx),nx:-dy/len,ny:dx/len,tx:dx/len,ty:dy/len,branchProgress:branch.distances[i-1]+len*t,progress:branch.entry+(branch.exit-branch.entry)*(branch.distances[i-1]+len*t)/branch.length};}
 return best;
}

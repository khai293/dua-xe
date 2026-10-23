import {sampleTrack,clamp} from './data.js?v=10';
import {displayName,replaceNames,HEART_BRACELET} from './profile.js?v=10';

const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const captions=[
 [0,'aurora','Em đã làm được rồi!','CHIẾN THẮNG · NHÀ VÔ ĐỊCH CỦA THÀNH PHỐ'],
 [5,'lucien','Chúc mừng em! Cuối cùng em cũng thắng được anh rồi.','MỘT LỜI HẸN Ở VẠCH ĐÍCH'],
 [8.5,'aurora','Em đã bảo mà! Anh đừng có xem thường em chứ.','MỘT LỜI HẸN Ở VẠCH ĐÍCH'],
 [11,'lucien','Anh có một món quà dành cho nhà vô địch.','MÓN QUÀ BÍ MẬT'],
 [15,'aurora','Một trái tim nhỏ… em sẽ giữ nó thật cẩn thận.','VÒNG TAY TRÁI TIM'],
 [20,'lucien','Nhà vô địch hôm nay muốn ăn gì nào?','CHUYẾN ĐI CỦA HAI NGƯỜI'],
 [23,'aurora','Gì cũng được, miễn là anh mời!','HẢI PHÒNG · THÀNH PHỐ LÊN ĐÈN'],
 [27,'lucien','Vậy lên xe đi, anh đưa em đi ăn tối.','ĐƯỜNG VỀ CÒN DÀI, MÌNH ĐI CÙNG NHAU'],
 [34,'aurora','Quán này thơm quá! Hôm nay em ăn cho cả nhà vô địch nhé.','MỘT GÓC PHỐ, MỘT BỮA TỐI ẤM'],
 [40,'lucien','Ừ, miễn là ngày mai em vẫn hẹn anh ở vạch đích.','HẠNH PHÚC LÀ NHỮNG ĐIỀU BÌNH THƯỜNG'],
 [43,'aurora','Hẹn anh. Và nhiều chuyến đi nữa.','ĐƯỜNG ĐẾN TÌNH YÊU · CÒN TIẾP…']
];

/** One engine timeline owns all motion. No timers or rewards live in the director. */
export class CinematicDirector {
 constructor(renderer,engine){
  this.renderer=renderer;this.engine=engine;this.canvas=renderer.canvas;this.active=false;this.lastCaption='';
  const section=document.createElement('section');section.id='endingScreen';section.className='ending-screen';section.hidden=true;section.setAttribute('aria-label','Đoạn kết Đường Đến Tình Yêu');
  section.innerHTML='<div class="ending-top"><span id="endingChapter"></span><button id="skipEnding" class="light-link">Bỏ qua →</button></div><span id="endingPreview" class="preview-tag"></span><div class="ending-caption"><span id="endingSpeaker"></span><h2 id="endingText"></h2><small id="endingNote"></small></div><div id="endingComplete" class="ending-complete" hidden><span>♡</span><p id="endingMemoryTitle"></p><h2>ĐƯỜNG ĐẾN TÌNH YÊU</h2><blockquote>Hành trình đẹp nhất không phải là về đích đầu tiên, mà là có người cùng mình đi đến cuối con đường.</blockquote><div class="ending-choices"><button id="endingReplay" class="secondary-button">Xem lại đoạn kết ↺</button><button id="endingGarage" class="secondary-button">Quay về gara</button><button id="endingCustom" class="secondary-button">Đua tự chọn ↗</button></div><button id="finishEnding" class="primary-button">GIỮ LẠI KHOẢNH KHẮC NÀY ♡</button></div><div class="ending-progress"><i id="endingProgress"></i></div>';
  document.body.append(section);this.element=section;
  document.getElementById('skipEnding').onclick=()=>engine.skipEnding();
  document.getElementById('finishEnding').onclick=()=>{engine.finishEnding();};
  document.getElementById('endingReplay').onclick=()=>{const preview=engine.state.ending?.preview;engine.finishEnding();preview?engine.previewEnding():engine.replayEnding();};
  for(const [id,where]of [['endingGarage','garage'],['endingCustom','custom']])document.getElementById(id).onclick=()=>{engine.finishEnding();window.dispatchEvent(new CustomEvent('endingNavigate',{detail:where}));};
 }
 asset(key){return this.renderer.assets[key]?.image;}
 sprite(key,index,cols,rows,x,y,height,alpha=1,rotation=0){
  const img=this.asset(key);if(!img)return;const g=this.renderer.ctx,sw=img.width/cols,sh=img.height/rows,w=height*sw/sh;
  g.save();g.globalAlpha=alpha;g.translate(x,y);g.rotate(rotation);g.drawImage(img,(index%cols)*sw,Math.floor(index/cols)*sh,sw,sh,-w/2,-height,w,height);g.restore();
 }
 cover(img,zoom=1,dx=0){if(!img)return;const r=this.renderer,g=r.ctx,W=r.width,H=r.height,s=Math.max(W/img.width,H/img.height)*zoom,w=img.width*s,h=img.height*s;g.drawImage(img,(W-w)/2+dx,(H-h)/2,w,h);}
 render(state,dt){
  if(state.phase!=='ending'){if(this.active){this.element.hidden=true;this.active=false;this.lastCaption='';}return false;}
  this.active=true;this.element.hidden=false;
  const e=state.ending,t=e.elapsed,r=this.renderer,track=state.track,W=r.width,H=r.height;
  const riding=t>=22&&t<34,restaurant=t>=34,view=t<26?'rear':t<30?'side':'front';
  // Author a continuous journey on the original OSM road; this never advances race state.
  const q=sampleTrack(track,riding?track.length*.19+(t-22)*8:Math.min(t,2)*2,0);
  const scene={...state,environment:{time:'night',weather:'clear'},obstacles:[],pickups:[],checkpoints:[],branches:[],chase:null,rivals:t<2.8?[{...sampleTrack(track,Math.min(t,2)*2-12+t*8,3),id:'lucien',speed:Math.max(0,8-t*2.7)}]:[],cameraMode:t>=30?1:0,
   player:{...state.player,...q,speed:riding?8:Math.max(0,5-t*2),lean:riding?Math.sin(t)*.05:0,brake:0,nitroActive:false,drifting:false},
   cinematic:{duo:riding,hideRiders:!riding&&t>=2,view,azimuth:riding?(view==='side'?1.05:view==='front'?2.35:0):0}};
  if(!restaurant)r.render(scene,dt);else{r.resize();r.ctx.setTransform(r.dpr,0,0,r.dpr,0,0);this.cover(this.asset('ending.dinner'),1.02+Math.min(.04,(t-34)*.002));}
  const g=r.ctx,w=r.width,h=r.height;
  if(t>=2&&t<12){
   const ground=h*.79,size=Math.min(h*.57,w*.48),sway=Math.sin(t*2)*.006;
   this.sprite('ending.poses',0,4,2,w*.38,ground+Math.sin(t*2)*2,size,1,sway);
   if(t>=2.8)this.sprite('ending.poses',1,4,2,w*(.98-.36*smooth((t-2.8)/3)),ground+Math.sin(t*10)*Math.max(0,1-smooth((t-2.8)/3))*2,size,1,-sway);
  }else if(t>=12&&t<22){
   const opened=t>=15.2,shift=smooth((t-15)/2),height=Math.min(h*.65,w*.7);
   this.sprite('ending.poses',opened?3:2,4,2,w*(.52-.2*shift),h*.82,height,1,Math.sin(t)*.005);
   if(t>14.7){
    const glow=clamp((t-15)/.7,0,1)*clamp((22-t)/1.5,0,1),gx=w*.74,gy=h*.48;
    const halo=g.createRadialGradient(gx,gy,0,gx,gy,Math.min(w,h)*.3);halo.addColorStop(0,'#ffdc9166');halo.addColorStop(1,'#ffdc9100');g.fillStyle=halo;g.fillRect(0,0,w,h);
    this.sprite('ending.gift',opened?1:0,2,1,gx,h*.73,Math.min(h*.44,w*.43)*(1+.025*Math.sin(t)),glow);
    g.fillStyle='#ffe5aa';for(let i=0;i<12;i++){const a=i*2.4+t*.25,rad=(.12+(i%3)*.035)*Math.min(w,h);g.globalAlpha=glow*(.3+.5*Math.sin(t*3+i)**2);g.beginPath();g.arc(gx+Math.cos(a)*rad,gy+Math.sin(a)*rad,1.5+i%2,0,Math.PI*2);g.fill();}g.globalAlpha=1;
   }
  }else if(t>=34&&t<40){
   const u=(t-34)/6,stop=smooth(Math.min(1,u*3));
   if(t<35.6)this.sprite('duo',1,3,1,w*(.15+.12*stop),h*.84,Math.min(h*.46,w*.42));
   if(t>35.6)this.sprite('ending.poses',4+Math.floor(t*4)%2,4,2,w*(.34+.28*smooth((t-35.6)/4.4)),h*(.88-.13*smooth(u)),Math.min(h*.49,w*.48)*(1-.13*u),1,Math.sin(t*8)*.008);
  }else if(t>=40){
   // Alternating hand/face poses plus independent steam and lantern light.
   this.sprite('ending.poses',6+Math.floor((t-40)*1.15)%2,4,2,w*.64,h*.91,Math.min(h*.69,w*.75),1,Math.sin(t*.9)*.003);
   g.strokeStyle='#fff0cf66';g.lineWidth=1.5;for(let i=0;i<3;i++){const x=w*.62+i*12,y=h*.66-((t*13+i*15)%55);g.beginPath();g.moveTo(x,y+16);g.quadraticCurveTo(x+Math.sin(t*2+i)*7,y+8,x,y);g.stroke();}
  }
  // Very brief fades bridge locations without hiding the street for long.
  const boundaries=[5,12,22,34,40];let fade=0;for(const b of boundaries)fade=Math.max(fade,Math.max(0,1-Math.abs(t-b)/.35));if(fade>0){g.fillStyle=`rgba(15,36,40,${fade*.7})`;g.fillRect(0,0,w,h);}
  const line=[...captions].reverse().find(c=>t>=c[0])||captions[0],stamp=line[0]+JSON.stringify(this.engine.save.characterNames);
  if(stamp!==this.lastCaption){this.lastCaption=stamp;document.getElementById('endingChapter').textContent=line[3];document.getElementById('endingSpeaker').textContent=displayName(this.engine.save,line[1]);document.getElementById('endingText').textContent='“'+replaceNames(line[2],this.engine.save)+'”';}
  document.getElementById('endingPreview').hidden=!e.preview&&!e.replay;
  document.getElementById('endingPreview').textContent=e.preview?'XEM TRƯỚC · KHÔNG CẤP QUÀ':'KỶ NIỆM ĐÃ LƯU · XEM LẠI';
  document.getElementById('endingNote').textContent=t>=15&&t<22&&!e.preview?HEART_BRACELET.description:'';
  document.getElementById('endingProgress').style.width=`${Math.min(100,t/46*100)}%`;
  document.getElementById('endingComplete').hidden=!e.complete;
  document.getElementById('endingMemoryTitle').textContent=e.preview?'XEM TRƯỚC HOÀN TẤT':`${displayName(this.engine.save,'aurora')} & ${displayName(this.engine.save,'lucien')} · MỘT KỶ NIỆM ĐÃ LƯU`;
  return true;
 }
}

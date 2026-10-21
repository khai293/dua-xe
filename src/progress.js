import {loadSave,SAVE_KEY} from './engine.js';

export function exportProgress(save) {
 return JSON.stringify({format:'hpgp-progress',version:1,savedAt:new Date().toISOString(),save},null,2);
}

export function importProgress(text) {
 if(typeof text!=='string'||text.length>250000)throw new Error('File tiến trình quá lớn.');
 const payload=JSON.parse(text);
 if(payload?.format!=='hpgp-progress'||payload.version!==1||payload.save?.version!==8)throw new Error('File này không phải tiến trình Hải Phòng Grand Prix V8.');
 const raw=payload.save;
 const safe=loadSave({getItem:key=>key===SAVE_KEY?JSON.stringify(raw):null});
 // Accept only supported option values, regardless of where a backup originated.
 const settings=safe.settings;
 safe.settings={quality:['low','high','ultra'].includes(settings.quality)?settings.quality:'high',
  time:['day','sunset','night'].includes(settings.time)?settings.time:'day',weather:['clear','rain','fog'].includes(settings.weather)?settings.weather:'clear',
  sound:settings.sound!==false,carryEnabled:settings.carryEnabled!==false,
  controlScale:Math.max(.8,Math.min(1.4,Number(settings.controlScale)||1)),controlOpacity:Math.max(.35,Math.min(1,Number(settings.controlOpacity)||.8))};
 return safe;
}

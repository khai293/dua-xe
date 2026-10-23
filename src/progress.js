import {normalizeProfile} from './profile.js?v=10';
export function exportProgress(save){return JSON.stringify({format:'hpgp-progress',version:1,savedAt:new Date().toISOString(),save},null,2);}
export function importProgress(text){
 if(typeof text!=='string'||text.length>250000)throw new Error('File tiến trình quá lớn.');
 const p=JSON.parse(text);if(p?.format!=='hpgp-progress'||p.version!==1||![8,9].includes(p.save?.version))throw new Error('File không phải tiến trình V8/V9 hợp lệ.');
 return normalizeProfile(p.save);
}

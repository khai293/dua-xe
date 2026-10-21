import {cp,mkdir,rm,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base=new URL('../',import.meta.url),out=new URL('../dist/',import.meta.url);
const files=['index.html','style.css','src','assets'];
for(const name of files)await stat(new URL(name,base));
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of files)await cp(new URL(name,base),new URL(name,out),{recursive:true});
console.log('Static web build created in '+fileURLToPath(out));

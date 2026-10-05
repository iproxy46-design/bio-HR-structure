import {mkdir,writeFile} from 'node:fs/promises';
const source=process.argv[2]||'http://127.0.0.1:8787';
const output=process.argv[3]||'.sites-runtime/legacy-backup.json';
const response=await fetch(`${source}/api/org`);
if(!response.ok)throw Error('Legacy API unavailable');
const {state,revision}=await response.json();
const photos=[];
for(const employee of state.employees){
 if(!employee.photoVersion)continue;
 const photo=await fetch(`${source}/api/photos/${encodeURIComponent(employee.id)}`);
 if(!photo.ok)throw Error('Cannot back up a photo; migration stopped');
 photos.push({id:employee.id,contentType:photo.headers.get('content-type'),body:Buffer.from(await photo.arrayBuffer()).toString('base64')});
}
await mkdir(new URL('../.sites-runtime/',import.meta.url),{recursive:true});
await writeFile(output,JSON.stringify({state,revision,photos}),{flag:'wx',mode:0o600});
console.log(`Backup complete: ${state.units.length} units, ${state.employees.length} employees, ${photos.length} photos. Values not displayed.`);

import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initializeDatabase} from './database-init.mjs';
import {database} from '../lib/postgres';
import {saveOrg,readOrg} from '../lib/org-store';
import {normalizeOrg,validate,type State} from '../lib/org';
process.loadEnvFile('.dev.vars');
const file=process.argv[2];if(!file)throw Error('Pass the path to an export-legacy.mjs backup');
const backup=JSON.parse(readFileSync(file,'utf8')) as {state:State;photos:{id:string;contentType:string;body:string}[]};
if(!validate(backup.state))throw Error('Invalid source state');
await initializeDatabase();
try{
 const current=await readOrg();
 if(current.revision!=='initial'||current.state.units.length||current.state.employees.length)throw Error('Target database is not empty; refusing to overwrite it');
 // Stage binary photos first; source backup remains untouched and retryable.
 for(const photo of backup.photos)await database().query('INSERT INTO employee_photos(employee_id,content_type,body) VALUES($1,$2,$3) ON CONFLICT(employee_id) DO UPDATE SET content_type=excluded.content_type,body=excluded.body',[photo.id,photo.contentType,Buffer.from(photo.body,'base64')]);
 await saveOrg(backup.state,'','initial');
 const result=await readOrg();
 const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined&&v!==null).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
 assert.deepEqual(stable(result.state),stable(normalizeOrg(backup.state)));
 for(const photo of backup.photos){const row=await database().query('SELECT body FROM employee_photos WHERE employee_id=$1',[photo.id]);assert.ok(row.rows[0]?.body.equals(Buffer.from(photo.body,'base64')))}
 console.log(`Migration verified: ${result.state.units.length} units, ${result.state.employees.length} employees, ${backup.photos.length} photos. No personal values displayed.`);
}catch{console.error('Migration failed; source backup preserved. No personal values displayed.');process.exitCode=1}finally{await database().end()}

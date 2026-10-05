import {existsSync,mkdirSync,openSync,closeSync,renameSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
if(existsSync('.dev.vars'))process.loadEnvFile('.dev.vars');
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
const url=new URL(process.env.DATABASE_URL);
const output=resolve(process.argv[2]||`.sites-runtime/backups/org-${Date.now()}.dump`);
if(existsSync(output))throw Error('Backup destination already exists');
mkdirSync(dirname(output),{recursive:true});
const partial=output+'.partial',fd=openSync(partial,'wx',0o600);
const binary=process.env.PG_BIN?join(process.env.PG_BIN,process.platform==='win32'?'pg_dump.exe':'pg_dump'):'pg_dump';
try{
 const result=spawnSync(binary,['-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d',url.pathname.slice(1),'-Fc'],{windowsHide:true,stdio:['ignore',fd,'inherit'],env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)}});
 if(result.status!==0)throw Error('Backup failed; partial file retained for diagnosis');
}finally{closeSync(fd)}
renameSync(partial,output);console.log(`PostgreSQL backup saved: ${output}`);

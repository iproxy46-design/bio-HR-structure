import {existsSync,mkdirSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseEnv} from 'node:util';
const bin=process.env.PG_BIN;if(!bin)throw Error('Set PG_BIN to the directory containing initdb and pg_ctl');
const data=resolve('.sites-runtime/postgres'),settings=resolve('.sites-runtime/postgres-local.json');
mkdirSync(resolve('.sites-runtime'),{recursive:true});
const config=existsSync(settings)?JSON.parse(readFileSync(settings,'utf8')):{user:'bioapp',password:randomBytes(24).toString('hex'),port:55432};
if(!existsSync(settings))writeFileSync(settings,JSON.stringify(config),{mode:0o600});
const suffix=process.platform==='win32'?'.exe':'';
function run(name,args,allowFailure=false){const result=spawnSync(join(bin,name+suffix),args,{windowsHide:true,stdio:'ignore',env:{...process.env,PGPASSWORD:config.password}});if(!allowFailure&&result.status!==0)throw Error(`${name} failed (exit ${result.status}); inspect local PostgreSQL log`);return result.status}
if(!existsSync(join(data,'PG_VERSION'))){
 const passwordFile=resolve('.sites-runtime/postgres-password.tmp');writeFileSync(passwordFile,config.password,{mode:0o600});
 try{run('initdb',['-D',data,'-U',config.user,'--pwfile',passwordFile,'-A','scram-sha-256','-E','UTF8','--locale=C'])}finally{unlinkSync(passwordFile)}
}
if(run('pg_ctl',['-D',data,'status'],true)!==0)run('pg_ctl',['-D',data,'-l',resolve('.sites-runtime/postgres.log'),'-o',`-h 127.0.0.1 -p ${config.port}`,'-w','start']);
const base=['-h','127.0.0.1','-p',String(config.port),'-U',config.user];
if(run('psql',[...base,'-d','bio_org','-c','SELECT 1'],true)!==0)run('createdb',[...base,'bio_org']);
const source=readFileSync('.dev.vars','utf8'),env=parseEnv(source);
if(!env.DATABASE_URL){writeFileSync('.dev.vars',source.trimEnd()+`\nDATABASE_URL="postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/bio_org"\n`)}
console.log(`Local PostgreSQL ready on 127.0.0.1:${config.port}; connection configured without displaying credentials.`);

import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--import','tsx','scripts/test-postgres.ts'],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exit(result.status??1);

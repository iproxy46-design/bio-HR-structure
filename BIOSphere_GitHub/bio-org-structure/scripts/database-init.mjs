import {readFile} from 'node:fs/promises';
import pg from 'pg';
export async function initializeDatabase(){
 if(!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL in .dev.vars');
 const client=new pg.Client({connectionString:process.env.DATABASE_URL});
 await client.connect();
 try{await client.query(await readFile(new URL('../db/postgres.sql',import.meta.url),'utf8'))}finally{await client.end()}
}

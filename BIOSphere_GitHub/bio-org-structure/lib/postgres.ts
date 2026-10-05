import {Pool} from "pg";
const globalDatabase=globalThis as typeof globalThis & {bioPool?:Pool};
export function database(){
 if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is not configured");
 return globalDatabase.bioPool??=new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
}

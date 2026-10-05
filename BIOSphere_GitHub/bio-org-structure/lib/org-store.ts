import {database} from "./postgres";
import {normalizeOrg,validate,type State,type Unit,type Employee} from "./org";
export class Conflict extends Error {}
export async function readOrg(){
 const client=await database().connect();
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const revision=await client.query<{revision:string}>('SELECT revision FROM org_revision WHERE id=1');
  const units=await client.query<Unit>(`SELECT id,name,parent_id AS parent,headcount AS count,leader_id AS "leaderId" FROM units ORDER BY position,id`);
  const employees=await client.query<Employee>(`SELECT id,name,role,department AS dept,unit_id AS unit,location AS city,phone,email,manager_text AS manager,manager_id AS "managerId",photo_url AS "photoUrl",photo_version AS "photoVersion" FROM employees ORDER BY position,id`);
  await client.query('COMMIT');
  const clean=<T,>(row:T):T=>Object.fromEntries(Object.entries(row as object).filter(([,value])=>value!==null)) as T;
  return {state:normalizeOrg({units:units.rows.map(clean),employees:employees.rows.map(clean)}),revision:revision.rows[0]?.revision||'initial'};
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
export async function saveOrg(input:State,_origin:string,revision:string){
 const state=normalizeOrg(input);
 if(!validate(state))throw Error('Invalid organization');
 const client=await database().connect();
 try{
  await client.query('BEGIN');
  const current=await client.query<{revision:string}>('SELECT revision FROM org_revision WHERE id=1 FOR UPDATE');
  if(current.rows[0]?.revision!==revision)throw new Conflict('Данные уже изменены другим администратором. Обновите страницу и повторите изменения.');
  await client.query('SET CONSTRAINTS ALL DEFERRED');
  for(const [index,u] of state.units.entries())await client.query(`INSERT INTO units(id,name,parent_id,headcount,leader_id,position) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=excluded.name,parent_id=excluded.parent_id,headcount=excluded.headcount,leader_id=excluded.leader_id,position=excluded.position`,[u.id,u.name,u.parent||null,u.count??null,u.leaderId||null,index]);
  for(const [index,p] of state.employees.entries())await client.query(`INSERT INTO employees(id,name,role,department,unit_id,location,phone,email,manager_text,manager_id,photo_url,photo_version,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,department=excluded.department,unit_id=excluded.unit_id,location=excluded.location,phone=excluded.phone,email=excluded.email,manager_text=excluded.manager_text,manager_id=excluded.manager_id,photo_url=excluded.photo_url,photo_version=excluded.photo_version,position=excluded.position`,[p.id,p.name,p.role??null,p.dept??null,p.unit||null,p.city??null,p.phone??null,p.email??null,p.manager??null,p.managerId||null,p.photoUrl||null,p.photoVersion||null,index]);
  await client.query('DELETE FROM employee_photos WHERE employee_id IN (SELECT id FROM employees WHERE NOT(id=ANY($1::text[])))',[state.employees.map(p=>p.id)]);
  await client.query('DELETE FROM employees WHERE NOT(id=ANY($1::text[]))',[state.employees.map(p=>p.id)]);
  await client.query('DELETE FROM units WHERE NOT(id=ANY($1::text[]))',[state.units.map(u=>u.id)]);
  const next=crypto.randomUUID();await client.query('UPDATE org_revision SET revision=$1 WHERE id=1',[next]);
  await client.query('COMMIT');return next;
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

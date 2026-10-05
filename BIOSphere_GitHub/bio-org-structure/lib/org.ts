import {capitalizeRole} from "./role-title";
export type Unit = {id:string; name:string; parent?:string; count?:number; leaderId?:string};
export type Employee = {id:string; name:string; role?:string; dept?:string; unit?:string|null; city?:string; phone?:string; email?:string; manager?:string; managerId?:string; photoUrl?:string; photoVersion?:string};
export type State = {units:Unit[]; employees:Employee[]};
export function normalizeOrg(state:State):State {
 const units=state.units.map(unit=>unit.id==="coffee"&&unit.name==="Отдел по продаже кофейного оборудования"
  ?{...unit,parent:"marketing",name:"Направление по развитию кофейных продаж"}
  :unit.id==="loghead"&&unit.name==="Заместитель ген. директора по логистике и склад. хозяйству"
   ?{...unit,name:"Заместитель генерального директора по логистике и складскому хозяйству"}:unit);
 const employees=state.employees.map(person=>{
  const role=person.id==="source-5"&&/^Зам\.\s*ген\.\s*директора по логистике/i.test(person.role||"")
   ?"Заместитель генерального директора по логистике и складскому хозяйству"
   :person.role===undefined?undefined:capitalizeRole(person.role.replace(/[\u0000-\u001f]+/g," ").replace(/\s+/g," ").trim());
  const dept=person.unit==="coffee"&&person.dept==="Отдел по продаже кофейного оборудования"
   ?"Направление по развитию кофейных продаж":person.dept;
  return role===person.role&&dept===person.dept?person:{...person,role,dept};
 });
 return {units,employees};
}
export function validate(value: unknown): value is State {
 if (!value||typeof value!=="object")return false;
 const s=value as State;
 if (!Array.isArray(s.units)||!Array.isArray(s.employees)||s.units.length>500||s.employees.length>2000)return false;
 const ids=new Set<string>();
 for(const u of s.units){if(!u||typeof u.id!=="string"||typeof u.name!=="string"||!u.id||u.id==='all'||!/^[a-zA-Z0-9_-]{1,100}$/.test(u.id)||!u.name.trim()||u.name.length>160||ids.has(u.id)||u.parent!==undefined&&typeof u.parent!=="string"||u.count!==undefined&&(!Number.isInteger(u.count)||u.count<0))return false;ids.add(u.id)}
 for(const u of s.units){if(u.parent&&!ids.has(u.parent))return false;const seen=new Set<string>([u.id]);let current=u;while(current.parent){if(seen.has(current.parent))return false;seen.add(current.parent);current=s.units.find(x=>x.id===current.parent)!}}
 const persons=new Set<string>();
 for(const p of s.employees){if(!p||typeof p.id!=="string"||!p.id||typeof p.name!=="string"||!p.name.trim()||p.name.length>160||persons.has(p.id)||p.unit&&!ids.has(p.unit))return false;persons.add(p.id);for(const key of ['role','dept','city','phone','email','manager'] as const){if(p[key]!==undefined&&(typeof p[key]!=="string"||p[key].length>250))return false}if(p.photoVersion&&(!/^\d{1,20}$/.test(p.photoVersion)))return false}
 for(const p of s.employees){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(p.id))return false;if(p.photoUrl&&(typeof p.photoUrl!=="string"||p.photoUrl.length>2000||!/^https:\/\//i.test(p.photoUrl)))return false}
 for(const u of s.units){if(u.leaderId!==undefined&&(typeof u.leaderId!=="string"||!s.employees.some(p=>p.id===u.leaderId&&p.unit===u.id)))return false}
 for(const p of s.employees){
  if(p.managerId!==undefined&&(typeof p.managerId!=="string"||!persons.has(p.managerId)))return false;
  const seen=new Set([p.id]);let current=p;
  while(current.managerId){if(seen.has(current.managerId))return false;seen.add(current.managerId);current=s.employees.find(x=>x.id===current.managerId)!;if(!current)return false}
 }
 return JSON.stringify(s).length<1_000_000;
}

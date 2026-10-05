import type {Employee,State} from "./org";

export function hasLeaderTitle(person:Employee){
 return /(?:^|[^\p{L}])руководитель(?=$|[^\p{L}])/iu.test(person.role||"");
}

export function isUnitLeader(person:Employee){
 const role=(person.role||"").trim();
 return /^(?:(?:генеральный|финансовый|коммерческий|исполнительный|технический)\s+)?директор(?:\s|$)/i.test(role)
  || /^(?:руководитель|начальник|заведующ(?:ий|ая))\s+(?:отдела|отделом|управления|департамента|подразделения|службы|склада|складом|направления|региона)(?:\s|$)/i.test(role)
  || /^главный бухгалтер$/i.test(role);
}

export function unitLeader(unitId:string,state:State):Employee|undefined{
 const unit=state.units.find(item=>item.id===unitId);
 if(!unit)return;
 const members=state.employees.filter(item=>item.unit===unitId);
 if(unit.leaderId)return members.find(item=>item.id===unit.leaderId);
 // These nodes are director positions in the organization tree, not departments.
 if(["ceo","loghead","devhead","financehead","saleshead"].includes(unit.id)&&members.length===1)return members[0];
 const candidates=members.filter(item=>isUnitLeader(item)||item.role?.trim().toLocaleLowerCase("ru")===unit.name.trim().toLocaleLowerCase("ru"));
 // Ambiguous titles must be resolved explicitly in the department editor.
 return candidates.length===1?candidates[0]:undefined;
}

export function employeeManagerPerson(person:Employee,state:State):Employee|undefined{
 let unit=state.units.find(item=>item.id===person.unit);
 const visited=new Set<string>();
 const eligibleUnits=new Set<string>();
 while(unit&&!visited.has(unit.id)){
  visited.add(unit.id);
  const leader=unitLeader(unit.id,state);
  if(leader&&leader.id!==person.id)return leader;
  if(leader?.id!==person.id)eligibleUnits.add(unit.id);
  unit=state.units.find(item=>item.id===unit?.parent);
 }
 // The nearest department head takes precedence over old individual overrides.
 const eligible=(item:Employee)=>item.id!==person.id&&(!person.unit||!!item.unit&&eligibleUnits.has(item.unit));
 if(person.managerId){const manager=state.employees.find(item=>item.id===person.managerId&&eligible(item));if(manager)return manager}
 if(person.manager?.trim()){
  const normalize=(value:string)=>value.trim().replace(/\s+/g," ").toLocaleLowerCase("ru").replace(/ё/g,"е");
  const matches=state.employees.filter(item=>eligible(item)&&normalize(item.name)===normalize(person.manager!));
  return matches.length===1?matches[0]:undefined;
 }
}

export function employeeManager(person:Employee,state:State){
 return employeeManagerPerson(person,state)?.name||(!person.unit&&person.manager?.trim())||"Не указан";
}

export function shortTitle(value:string){
 return value.replace(/заместитель генерального директора/gi,match=>match.replace(/генерального директора/i,'ген. директора'));
}
export function startsWithWord(value:string|null|undefined,query:string){
 const normalize=(text:string)=>text.toLocaleLowerCase('ru').replace(/ё/g,'е');
 const words=normalize(value||'').match(/[\p{L}\p{N}]+/gu)||[];
 const terms=normalize(query).match(/[\p{L}\p{N}]+/gu)||[];
 return terms.length>0&&terms.every(term=>words.some(word=>word.startsWith(term)));
}
export function startsWithSurname(fullName:string,query:string){
 const normalize=(value:string)=>value.trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
 const surname=normalize(fullName).split(/\s+/)[0]||'';
 const prefix=normalize(query);
 return prefix.length>0&&surname.startsWith(prefix);
}

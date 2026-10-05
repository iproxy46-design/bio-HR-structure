import {validate,type State,type Unit} from './org';
export function branchIds(units:Unit[],id:string){
 const ids=new Set([id]);let changed=true;
 while(changed){changed=false;for(const unit of units)if(unit.parent&&ids.has(unit.parent)&&!ids.has(unit.id)){ids.add(unit.id);changed=true}}
 return ids;
}
function checked(state:State){
 const next={...state,employees:state.employees.map(p=>({...p,dept:state.units.find(u=>u.id===p.unit)?.name||p.dept}))};
 if(!validate(next))throw Error('Проверьте структуру: нельзя создавать циклы, дублировать ID или назначать руководителя из другого отдела.');
 return next;
}
export function updateUnit(state:State,unit:Unit){
 const existing=state.units.some(u=>u.id===unit.id);
 if(unit.parent&&branchIds(state.units,unit.id).has(unit.parent))throw Error('Нельзя перенести подразделение внутрь собственной ветки.');
 return checked({...state,units:existing?state.units.map(u=>u.id===unit.id?unit:u):[...state.units,unit]});
}
export function splitUnit(state:State,sourceId:string,unit:Unit,employeeIds:string[],childIds:string[]){
 if(!state.units.some(u=>u.id===sourceId)||state.units.some(u=>u.id===unit.id))throw Error('Подразделение не найдено или уже существует.');
 if(employeeIds.some(id=>!state.employees.some(p=>p.id===id&&p.unit===sourceId))||childIds.some(id=>!state.units.some(u=>u.id===id&&u.parent===sourceId)))throw Error('Выберите сотрудников и команды исходного подразделения.');
 if(childIds.some(id=>unit.parent&&branchIds(state.units,id).has(unit.parent)))throw Error('Новое подразделение нельзя размещать внутри переносимой команды.');
 const selected=new Set(employeeIds);
 return checked({units:[...state.units.map(u=>({...u,parent:childIds.includes(u.id)?unit.id:u.parent,leaderId:u.id===sourceId&&u.leaderId&&selected.has(u.leaderId)?undefined:u.leaderId})),unit],employees:state.employees.map(p=>selected.has(p.id)?{...p,unit:unit.id}:p)});
}
export function deleteUnit(state:State,id:string,target?:string){
 if(!state.units.some(u=>u.id===id))throw Error('Подразделение не найдено.');
 const occupied=state.employees.some(p=>p.unit===id)||state.units.some(u=>u.parent===id);
 if(occupied&&!target)throw Error('Выберите, куда перенести сотрудников и вложенные команды.');
 if(target&&(!state.units.some(u=>u.id===target)||branchIds(state.units,id).has(target)))throw Error('Выберите подразделение вне удаляемой ветки.');
 return checked({units:state.units.filter(u=>u.id!==id).map(u=>u.parent===id?{...u,parent:target}:u),employees:state.employees.map(p=>p.unit===id?{...p,unit:target||null}:p)});
}

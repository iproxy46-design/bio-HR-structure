import * as XLSX from "xlsx";
import {validate,type State,type Employee} from "./org";
import {employeeManager} from "./org-display";
import {capitalizeRole} from "./role-title";
export const headers=["","","Имя","Отчество","Фамилия","Отдел","Должность","Местонахождение"];
const norm=(s:string)=>s.replace(/[\u200B-\u200D\uFEFF]/g,"").trim().replace(/\s+/g," ").toLocaleLowerCase("ru").replace(/ё/g,"е");
const columnName=(s:string)=>{const key=norm(s).replace(/[\s.():*\/_-]+/g,"");const aliases:Record<string,string>={фио:"фио",фамилияимяотчество:"фио",имя:"имя",отчество:"отчество",фамилия:"фамилия",отдел:"отдел",подразделение:"отдел",структурноеподразделение:"отдел",наименованиеотдела:"отдел",должность:"должность",город:"город",городработы:"город",местонахождение:"город",id:"id",телефон:"телефон",почта:"почта",email:"email",руководитель:"руководитель",ссылканафото:"ссылка на фото"};return aliases[key]||norm(s)};
const isHeader=(columns:string[])=>columns.includes("фио")||(columns.includes("имя")&&columns.includes("фамилия"));
export function workbook(state:State,origin:string,template=false):Uint8Array{
 const rows=template?[]:state.employees.map(p=>{const [last="",first="",...middle]=p.name.trim().split(/\s+/);return ["","",first,middle.join(" "),last,state.units.find(u=>u.id===p.unit)?.name||p.dept||"",capitalizeRole(p.role||""),p.city||""]});
 const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet([headers,...rows]);
 sheet["!cols"]=headers.map((_,i)=>({wch:i<2?4:28}));sheet["!autofilter"]={ref:`C1:H${rows.length+1}`};
 XLSX.utils.book_append_sheet(book,sheet,"Сотрудники");
 const details=XLSX.utils.aoa_to_sheet([["ID","ФИО","Телефон","Почта","Руководитель","Ссылка на фото"],...(template?[]:state.employees.map(p=>[p.id,p.name,p.phone||"",p.email||"",employeeManager(p,state),p.photoVersion?`${origin}/api/photos/${encodeURIComponent(p.id)}?v=${p.photoVersion}`:p.photoUrl||""]))]);
 details["!cols"]=[{wch:38},{wch:40},{wch:24},{wch:32},{wch:40},{wch:70}];
 XLSX.utils.book_append_sheet(book,details,"Контакты и фото");
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["Допустимые отделы"],...state.units.map(u=>[u.name])]),"Отделы");
 return new Uint8Array(XLSX.write(book,{type:"array",bookType:"xlsx",compression:true}));
}
export function importWorkbook(bytes:ArrayBuffer,current:State):State{
 const book=XLSX.read(bytes,{type:"array",sheetRows:2052,cellHTML:false});
 const candidates=book.SheetNames.map(name=>({name,sheet:book.Sheets[name],rows:XLSX.utils.sheet_to_json<string[]>(book.Sheets[name],{header:1,raw:false,defval:"",range:0,blankrows:true})}));
 const recognized=candidates.map(candidate=>({...candidate,headerIndex:candidate.rows.slice(0,50).findIndex(row=>isHeader(row.map(v=>columnName(String(v)))))}));
 const selected=recognized.find(c=>c.name==="Сотрудники"&&c.headerIndex>=0)||recognized.find(c=>c.headerIndex>=0)||recognized.find(c=>c.name==="Сотрудники")||recognized[0];
 const sheet=selected?.sheet;
 if(!sheet)throw Error("В книге нет листа сотрудников");
 const range=XLSX.utils.decode_range(sheet["!fullref"]||sheet["!ref"]||"A1");
 if(range.e.r>2050||range.e.c>50)throw Error("Лист должен содержать не более 2000 сотрудников, 50 вводных строк и 51 столбца");
 const allRows=selected.rows;
 const headerIndex=selected.headerIndex;
 const start=headerIndex>=0?headerIndex+1:allRows.findIndex(row=>[2,4].every(i=>String(row[i]??"").trim())&&columnName(String(row[2]))!=="имя");
 if(start<0)throw Error("Не найдены строки сотрудников. Ожидаются C: Имя, D: Отчество, E: Фамилия, F: Отдел, G: Должность, H: Город.");
 const rows=allRows.slice(start);
 const columns=(headerIndex>=0?allRows[headerIndex]:headers).map(v=>columnName(String(v)));
 if(new Set(columns.filter(Boolean)).size!==columns.filter(Boolean).length)throw Error("Повторяющиеся заголовки столбцов");
 const has=(...names:string[])=>names.some(n=>columns.includes(norm(n)));
 if(!(has("ФИО")||(has("Фамилия")&&has("Имя"))))throw Error("Нужны столбцы Имя и Фамилия; Отчество можно оставить пустым");
 const employees=[...current.employees],seen=new Set<string>();
 let employeeNumber=0;
 for(const [i,row] of rows.entries()){
  if(!row.some(v=>String(v).trim()))continue;if(isHeader(row.map(v=>columnName(String(v)))))continue;if(seen.size>=2000)throw Error("Допускается не более 2000 сотрудников");
  const get=(...names:string[])=>{const index=columns.findIndex(c=>names.some(n=>norm(n)===c));return index<0?"":String(row[index]??"").trim()};
  const fail=(message:string):never=>{throw Error(`Строка ${start+i+1}: ${message}`)};
  const surname=get("Фамилия").split(/\s+/).filter(Boolean).at(-1)||"";
  const name=[surname,get("Имя"),get("Отчество")].filter(Boolean).join(" ")||get("ФИО");
  if(!get("ФИО")&&(!get("Имя")||!get("Фамилия")))fail("заполните Имя (C) и Фамилию (E); Отчество (D) необязательно");
  employeeNumber++;
  const previous=current.employees.find(p=>p.id===`source-${employeeNumber}`)||current.employees.find(p=>norm(p.name)===`сотрудник ${employeeNumber}`);
  if(!previous)fail(`не найден «Сотрудник ${employeeNumber}» в структуре. Файл должен содержать строки сотрудников по порядку, начиная с номера 1.`);
  const p:Employee={...previous!,name,...(has("Должность")?{role:capitalizeRole(get("Должность"))}: {})};
  if(seen.has(p.id))fail("повторяющийся номер сотрудника");seen.add(p.id);
  employees[employees.findIndex(e=>e.id===p.id)]=p;
 }
 if(!seen.size)throw Error("В файле нет сотрудников");
 const state={units:current.units,employees};if(!validate(state))throw Error("Проверьте длину полей и количество сотрудников");return state;
}

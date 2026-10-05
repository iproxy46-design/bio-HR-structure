const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict'), ts=require('typescript'), XLSX=require('xlsx');
function load(file,deps){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:n=>deps[n]||(n==='./org-display'?load('lib/org-display.ts',{}):n==='./role-title'?load('lib/role-title.ts',{}):require(n)),Uint8Array});return exports}
const fixture={units:[{id:'test-unit',name:'Тестовый отдел'}],employees:[1,2,3].map(n=>({id:`source-${n}`,name:`Сотрудник ${n}`,unit:'test-unit',role:'Исходная должность',city:'Тестовый город'}))};
const org=load('lib/org.ts',{'./seed.json':fixture});
const {workbook,importWorkbook}=load('lib/employees-excel.ts',{'./org':org});
const state=JSON.parse(JSON.stringify(fixture));
state.employees.reverse(); // Number, not array order or department, controls the mapping.
const head=['','','Имя','Отчество','Фамилия','Отдел','Должность','Город'];
const row=['','','Иван','Иванович','лишний текст Иванов','Неизвестный отдел','Другая должность','Другой город'];
function file(rows){const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet(rows),'Сотрудники');return XLSX.write(b,{type:'array',bookType:'xlsx'})}
for(const rows of [[head,row],[['Список'],[],head,row],[row]]){
 const result=importWorkbook(file(rows),state);
 const before=state.employees.find(p=>p.id==='source-1'),after=result.employees.find(p=>p.id==='source-1');
 assert.equal(after.name,'Иванов Иван Иванович');
 assert.equal(after.role,'Другая должность');
 assert.equal(JSON.stringify({...after,name:before.name,role:before.role}),JSON.stringify(before));
 assert.equal(result.employees.length,state.employees.length);
 assert.equal(result.employees.find(p=>p.id==='source-2').name,'Сотрудник 2');
 const again=importWorkbook(file([head,['','','Анна','','Петрова']]),result);
 assert.equal(again.employees.find(p=>p.id==='source-1').name,'Петрова Анна');
}
const result=importWorkbook(file([head,row,[],['','','Анна','','Петрова']]),state);
assert.equal(result.employees.find(p=>p.id==='source-2').name,'Петрова Анна');
assert.equal(state.employees.find(p=>p.id==='source-1').name,'Сотрудник 1');
assert.throws(()=>importWorkbook(file([head,['','','Иван']]),state),/Фамилию/);
assert.throws(()=>importWorkbook(file([head]),state),/нет сотрудников/);
const book=XLSX.read(workbook(result,'http://127.0.0.1:8787'),{type:'array'});
assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets['Сотрудники'],{header:1})[0],head.map(value=>value==='Город'?'Местонахождение':value));
console.log('PASS: row-to-number mapping, repeated rename, preserved tree and details, blank/header rows, optional patronymic, validation, export columns');

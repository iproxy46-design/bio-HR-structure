const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file){
 const result={exports:{},require:n=>n==="./role-title"?load("lib/role-title.ts"):({units:[],employees:[]})};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,result);
 return result.exports;
}
const {shortTitle,startsWithWord,startsWithSurname,isUnitLeader,unitLeader,employeeManager}=load('lib/org-display.ts');
const {validate,normalizeOrg}=load('lib/org.ts');
const {employeeManagerPerson}=load('lib/org-display.ts');
const managerFixture={units:[],employees:[{id:'head',name:'Тест 1'}]};
assert.equal(employeeManagerPerson({id:'member',managerId:'head'},managerFixture)?.id,'head');
assert.equal(employeeManagerPerson({id:'member',manager:' тест  1 '},managerFixture)?.id,'head');
assert.equal(employeeManagerPerson({id:'head',managerId:'head'},managerFixture),undefined);
assert.equal(employeeManagerPerson({id:'member',manager:'Нет записи'},managerFixture),undefined);
assert.equal(employeeManagerPerson({id:'member',manager:'Тест 1'},{units:[],employees:[...managerFixture.employees,{id:'other',name:'Тест 1'}]}),undefined);
const {capitalizeRole}=load('lib/role-title.ts');
const hierarchy={units:[{id:'ceo',name:'Дирекция'},{id:'devhead',name:'Директор подразделения',parent:'ceo'},{id:'empty',name:'Отдел',parent:'devhead'},{id:'team',name:'Команда',parent:'empty'}],employees:[{id:'top',name:'Тест 0',unit:'ceo'},{id:'division',name:'Тест 1',unit:'devhead'},{id:'worker',name:'Тест 2',unit:'team',manager:'Несуществующая запись'}]};
assert.equal(employeeManagerPerson(hierarchy.employees[2],hierarchy)?.id,'division','Skip empty departments to the division director');
assert.equal(employeeManagerPerson(hierarchy.employees[1],hierarchy)?.id,'top','Director reports to the parent director');
assert.equal(employeeManagerPerson(hierarchy.employees[0],hierarchy),undefined,'Root director never reports to self');
for(const [input,expected] of [['менеджер по работе с РФ','Менеджер по работе с РФ'],['1С-разработчик','1С-разработчик'],['«старший специалист»','«Старший специалист»'],['  инженер API','  Инженер API'],['IT-специалист','IT-специалист'],['',''],['123','123']]){
 assert.equal(capitalizeRole(input),expected);
 assert.equal(capitalizeRole(capitalizeRole(input)),expected);
}
const capitalized=normalizeOrg({units:[{id:'test',name:'Тест'}],employees:[{id:'test',name:'фиктивная запись',unit:'test',role:'менеджер API'}]});
assert.equal(capitalized.employees[0].role,'Менеджер API');
assert.equal(capitalized.employees[0].name,'фиктивная запись');
assert.equal(startsWithSurname('Альфа Бета Гамма','ал'),true);
for(const query of ['ль','бе','га',''])assert.equal(startsWithSurname('Альфа Бета Гамма',query),false);
assert.equal(startsWithSurname('  Альфа Бета',' АЛ '),true);
assert.equal(startsWithWord('Склад логистика','л'),true);
assert.equal(startsWithWord('Склад логистика','к'),false);
assert.equal(startsWithWord('Логистика склад','лог ск'),true);
assert.equal(startsWithWord('Тест-доставка','дос'),true);
assert.equal(startsWithWord('Ёлка','е'),true);
assert.equal(startsWithWord('Склад',''),false);
assert.equal(shortTitle('Заместитель генерального директора по логистике'),'Заместитель ген. директора по логистике');
// Synthetic identifiers only; never load employee data for these tests.
const org={units:[{id:'director',name:'Директор'},{id:'regional',name:'Региональные продажи',parent:'director'},{id:'finance',name:'Финансы',parent:'director'},{id:'child',name:'Регион',parent:'regional'}],employees:[
 {id:'d',name:'Тест 1',unit:'director',role:'Директор'},
 {id:'r1',name:'Тест 2',unit:'regional',role:'Руководитель отдела'},
 {id:'r2',name:'Тест 3',unit:'regional',role:'Руководитель по развитию отдела продаж'},
 {id:'f1',name:'Тест 4',unit:'finance',role:'Ведущий финансовый менеджер'},
 {id:'f2',name:'Тест 5',unit:'finance',role:'Аналитик'},
 {id:'r3',name:'Тест 6',unit:'regional',role:'Менеджер'},
 {id:'c1',name:'Тест 7',unit:'child',role:'Менеджер'},
]};
assert.equal(validate(org),true);
assert.equal(isUnitLeader(org.employees[3]),false);
assert.equal(isUnitLeader(org.employees[1]),true);
assert.equal(isUnitLeader(org.employees[2]),false);
assert.equal(isUnitLeader({role:'Заместитель руководителя отдела'}),false);
assert.equal(unitLeader('regional',org)?.id,'r1');
assert.equal(employeeManager(org.employees[5],org),'Тест 2');
assert.equal(employeeManager(org.employees[1],org),'Тест 1');
assert.equal(employeeManager(org.employees[6],org),'Тест 2');
assert.equal(employeeManager(org.employees[4],org),'Тест 1');
org.units[2].leaderId='f1';
assert.equal(employeeManager(org.employees[4],org),'Тест 4');
assert.equal(employeeManager(org.employees[3],org),'Тест 1');
assert.equal(validate(org),true);
org.employees[2].role='Руководитель отдела';
assert.equal(unitLeader('regional',org),undefined);
org.units[1].leaderId='r1';
assert.equal(unitLeader('regional',org)?.id,'r1');
org.employees[5].managerId='f1';
assert.equal(employeeManager(org.employees[5],org),'Тест 2','Nearest department head overrides an unrelated individual assignment');
org.employees[3].managerId='r3';
assert.equal(validate(org),false,'Reject reporting cycles');
delete org.employees[3].managerId;
org.employees[5].managerId='missing';
assert.equal(validate(org),false,'Reject missing managers');
delete org.employees[5].managerId;
org.units[2].leaderId='r1';
assert.equal(validate(org),false,'Head must belong to the department');
org.units[2].leaderId='f1';
assert.equal(validate(org),true);
assert.equal(employeeManager({id:'external',name:'Тест',manager:'Внешний руководитель'},org),'Внешний руководитель');
const cycle={units:[{id:'a',name:'A',parent:'b'},{id:'b',name:'B',parent:'a'}],employees:[]};
assert.equal(employeeManager({id:'p',name:'Тест',unit:'a'},cycle),'Не указан');
const legacy={units:[{id:'marketing',name:'Маркетинг'},{id:'coffee',name:'Отдел по продаже кофейного оборудования'},{id:'loghead',name:'Заместитель ген. директора по логистике и склад. хозяйству'}],employees:[{id:'source-5',name:'Тест',unit:'loghead',role:'Зам. ген. директора по логистике'}]};
const normalized=normalizeOrg(legacy);
assert.equal(normalized.units[1].parent,'marketing');
assert.equal(normalized.units[1].name,'Направление по развитию кофейных продаж');
assert.equal(normalized.employees[0].role,'Заместитель генерального директора по логистике и складскому хозяйству');
assert.equal(JSON.stringify(normalizeOrg(normalized)),JSON.stringify(normalized));
console.log('PASS: search, titles, unique department heads, manager references, validation, legacy normalization');

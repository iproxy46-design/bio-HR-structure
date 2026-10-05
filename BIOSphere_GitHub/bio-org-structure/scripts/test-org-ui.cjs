// Isolated UI regression checks: bundle the real component, serve synthetic data.
// Requires playwright-core (or PLAYWRIGHT_MODULE pointing to an installation).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const esbuild=require(process.env.ESBUILD_MODULE||'esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const longRole='Специалист по координации региональных проектов, развитию продаж кофейного оборудования и сопровождению информационных систем';
const units=[{id:'ceo',name:'Генеральный директор'},{id:'loghead',name:'Логистика',parent:'ceo'},{id:'devhead',name:'Развитие',parent:'ceo'},{id:'financehead',name:'Финансовый директор',parent:'ceo'},{id:'saleshead',name:'Коммерческий директор',parent:'ceo'},{id:'networks',name:'Отдел по работе с сетями',parent:'devhead'},{id:'marketing',name:'Отдел маркетинга',parent:'devhead',leaderId:'head'},{id:'coffee',name:'Направление по развитию кофейных продаж',parent:'marketing'},{id:'finance',name:'Финансовый отдел',parent:'financehead'},{id:'onec',name:'Отдел разработки 1С',parent:'financehead'},{id:'regional',name:'Отдел региональных продаж',parent:'devhead'}];
const employees=units.map((u,i)=>({id:`p${i}`,name:`Тест ${i}`,role:i===0?'Генеральный директор':'Специалист',unit:u.id,city:'Москва'}));
employees.push({id:'head',name:'Альфа Тест',role:'Ведущий специалист',unit:'marketing',city:'Москва'},{id:'member',name:'Бета Тест',role:longRole,unit:'marketing',city:'Москва',phone:'+70000000000',email:'test@example.invalid'});
let state={units,employees};
const initialState=JSON.stringify(state);let canEdit=true;const calls={photo:0,removePhoto:0};
async function main(){
 const bundle=await esbuild.build({stdin:{contents:'import React from "react";import{createRoot}from"react-dom/client";import Home from "./app/page";createRoot(document.getElementById("root")).render(<Home/>);',resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
 const css=fs.readFileSync('app/globals.css','utf8').replace(/^@import[^\n]+/gm,'');
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/api/org'){
   if(req.method==='PUT'){let body='';for await(const chunk of req)body+=chunk;state=JSON.parse(body)}
   res.setHeader('content-type','application/json');res.end(JSON.stringify({state,revision:'test',canEdit}));return;
  }
  if(req.url==='/api/admin/logout'){canEdit=false;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true}));return}
  if(req.url==='/api/admin/login'){canEdit=true;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true}));return}
  if(req.url?.startsWith('/api/photos/')){if(req.method==='POST'){calls.photo++;for await(const chunk of req)void chunk;res.setHeader('content-type','application/json');res.end(JSON.stringify({photoVersion:'123'}))}else if(req.method==='DELETE'){calls.removePhoto++;res.statusCode=204;res.end()}else{res.setHeader('content-type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLioAAAAASUVORK5CYII=','base64'))}return}
  if(req.url==='/app.js'){res.setHeader('content-type','application/javascript');res.end(bundle.outputFiles[0].text);return}
  if(req.url==='/bio-logo.png'){res.setHeader('content-type','image/png');res.end(fs.readFileSync('public/bio-logo.png'));return}
  res.setHeader('content-type','text/html;charset=utf-8');res.end(`<html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'bio-org-ui-'));
 try{
  for(const width of [1920,1440,1240,1024,900,768,660,610,390,320]){
   state=JSON.parse(initialState);canEdit=true;
   const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const fixtureUrl=`http://127.0.0.1:${server.address().port}`;
   if(process.env.UI_URL)await page.route('**/api/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:fixtureUrl+url.pathname+url.search});await route.fulfill({response})});
   await page.goto(process.env.UI_URL||fixtureUrl);
   await page.locator('.org-root').waitFor();
   const columns=page.locator('[data-unit-id="ceo"] > .org-reporting > .org-four-columns > .org-column');
   assert.equal(await columns.count(),4,'Original four-column layout retained');
   assert.deepEqual(await columns.evaluateAll(nodes=>nodes.map(node=>node.querySelector(':scope > .org-branch')?.getAttribute('data-unit-id'))),['loghead','devhead','financehead','saleshead']);
   assert.equal(await page.locator('[data-unit-id]').count(),state.units.length,'Every unit appears exactly once');
   await page.locator('.org-ceo-logistics-line path').waitFor({state:'attached'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Chart fits viewport');
   if(width<=1240){
    const boxes=await columns.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left}}));
    for(let i=1;i<boxes.length;i++){
     assert.ok(Math.abs(boxes[i].left-boxes[0].left)<1,'Reporting branches stack on narrow screens');
     assert.ok(boxes[i].top-boxes[i-1].bottom<=22,'No empty grid rows between reporting branches');
    }
   }
   const brandBox=await page.locator('.brand').boundingBox(),actionsBox=await page.locator('.header-actions').boundingBox();
   assert.ok(Math.abs(brandBox.y+brandBox.height/2-actionsBox.y-actionsBox.height/2)<2,'Brand and account actions share one row');
   await page.screenshot({path:path.join(output,`structure-${width}.png`),fullPage:true});

   const checkSearch=async()=>{for(const search of await page.locator('.search:visible').all()){
    const icon=await search.locator('svg').boundingBox(),input=await search.locator('input').boundingBox();
    assert.ok(Math.abs(icon.y+icon.height/2-input.y-input.height/2)<1,'Search icon centered');
    assert.ok(icon.x>input.x&&icon.x+icon.width<input.x+44,'Search icon within left padding');
   }};
   await checkSearch();
   for(const button of await page.locator('.org-unit-expand').all()){
    await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');
    const panel=page.locator(`#${await button.getAttribute('aria-controls')}`);
    assert.equal(await panel.isVisible(),true);
    await button.click();assert.equal(await button.getAttribute('aria-expanded'),'false');
    assert.equal(await panel.isVisible(),false);
   }
   const expand=page.getByRole('button',{name:'Показать сотрудников: Отдел маркетинга',exact:true});
   await expand.click();
   assert.equal(await page.locator('#members-marketing').isVisible(),true);
   assert.equal(await page.locator('#members-marketing .leader-label').count(),1);
   assert.equal(await page.evaluate(()=>document.activeElement?.className),'org-unit-expand','Focus survives rerender');
   await page.keyboard.press('Enter');assert.equal(await page.locator('#members-marketing').isVisible(),false);
   await page.getByRole('textbox',{name:'Поиск по началу фамилии в структуре'}).fill('Бета');
   assert.equal(await page.locator('#members-marketing').isVisible(),true);
   await page.getByRole('button',{name:'Скрыть сотрудников: Отдел маркетинга',exact:true}).click();
   assert.equal(await page.locator('#members-marketing').isVisible(),false);
   await page.getByRole('button',{name:'Показать сотрудников: Отдел маркетинга',exact:true}).click();
   await page.locator('#members-marketing .org-member').click();
   const modal=page.locator('.person-modal');
   assert.equal(await modal.locator('.profile-top p').textContent(),longRole);
   assert.match(await modal.locator('.profile-fields').textContent(),/РуководительАльфа Тест/);
   assert.equal(await modal.getByText('Местонахождение',{exact:true}).count(),1);
   assert.equal(await modal.getByRole('link',{name:'+70000000000',exact:true}).getAttribute('href'),'tel:+70000000000');
   assert.equal(await modal.getByRole('link',{name:'test@example.invalid',exact:true}).getAttribute('href'),'mailto:test@example.invalid');
   const close=await modal.locator('.close').boundingBox(),cross=await modal.locator('.close svg').boundingBox();
   assert.ok(Math.abs(close.x+close.width/2-cross.x-cross.width/2)<1&&Math.abs(close.y+close.height/2-cross.y-cross.height/2)<1,'Close icon centered');
   const paragraph=modal.locator('.profile-top p');assert.equal(await paragraph.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight),true,'Full title visible');
   await page.screenshot({path:path.join(output,`card-${width}.png`)});
   await modal.getByRole('button',{name:'+ Добавить сотрудника',exact:true}).click();
   assert.equal(await page.getByLabel('Подразделение',{exact:true}).inputValue(),'marketing');
   await page.getByRole('button',{name:'Отмена',exact:true}).click();
   await page.getByRole('button',{name:'Управление сотрудниками',exact:true}).click();
   const editor=page.locator('.editor-modal');await checkSearch();
   const before=await editor.boundingBox();
   await page.getByRole('textbox',{name:'Найти сотрудника в редакторе'}).fill('Нетсовпадений');
   const after=await editor.boundingBox();assert.equal(before.y,after.y,'Editor top does not jump when filtering');
   await page.getByRole('textbox',{name:'Найти сотрудника в редакторе'}).fill('');
   await page.getByRole('tab',{name:'Структура компании',exact:true}).click();
   await page.locator('.structure-name').filter({hasText:'Финансовый отдел'}).click();
   await page.getByLabel('Руководитель подразделения').selectOption('p8');
   await page.getByRole('button',{name:'Сохранить структуру',exact:true}).click();
   await page.locator('.structure-form').waitFor({state:'detached'});
   assert.equal(state.units.find(u=>u.id==='finance').leaderId,'p8');
   await page.getByRole('button',{name:'Закрыть редактор',exact:true}).click();
   await page.getByRole('button',{name:'Сбросить',exact:true}).click();
   await page.getByRole('tab',{name:'Сотрудники',exact:true}).click();await checkSearch();
   const chooseDepartment=async name=>{await page.getByRole('button',{name:'Фильтр: Подразделение',exact:true}).click();await page.getByRole('combobox',{name:'Поиск: Подразделение',exact:true}).fill(name);await page.getByRole('option').filter({hasText:name}).click()};
   for(const unit of state.units){
    await chooseDepartment(unit.name);
    const shown=await page.locator('.people-grid .person strong').allTextContents();
    const expected=state.employees.filter(person=>person.unit===unit.id).map(person=>person.name);
    assert.deepEqual(shown.sort(),expected.sort(),`Exact members for ${unit.id}`);
   }
   await chooseDepartment('Все подразделения');
   const filterBoxes=await page.locator('.employee-filters .search input,.employee-filters .filter-trigger').evaluateAll(nodes=>nodes.map(node=>({top:node.getBoundingClientRect().top,height:node.getBoundingClientRect().height})));
   assert.ok(filterBoxes.every(box=>box.height===47),'Filter controls have equal height');
   if(width>660)assert.ok(filterBoxes.every(box=>box.top===filterBoxes[0].top),'Filters align in one row');
   await page.getByRole('button',{name:'Фильтр: Подразделение',exact:true}).click();
   const departmentSearch=page.getByRole('combobox',{name:'Поиск: Подразделение',exact:true});
   await departmentSearch.fill('маркет');assert.equal(await page.getByRole('option').count(),1);
   await page.screenshot({path:path.join(output,`filters-${width}.png`)});
   await departmentSearch.press('Enter');
   assert.equal(await page.getByRole('button',{name:'Фильтр: Подразделение'}).getAttribute('aria-expanded'),'false');

   assert.equal(await page.locator('.people-grid .person').count(),3,'Department contains only direct members');
   await page.getByRole('textbox',{name:'Поиск сотрудника',exact:true}).fill('Бета');
   assert.equal(await page.locator('.people-grid .person').count(),1);
   await chooseDepartment('Финансовый отдел');
   assert.equal(await page.locator('.people-grid .person').count(),0,'Search respects department filter');
   await chooseDepartment('Все подразделения');
   assert.equal(await page.locator('.people-grid .person').count(),1);
   await page.getByRole('textbox',{name:'Поиск сотрудника',exact:true}).fill('');

   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'People and city filters fit viewport');
   await page.getByRole('button',{name:new RegExp('Бета Тест')}).click();
   await page.getByRole('button',{name:'Изменить / добавить руководителя',exact:true}).click();
   await page.getByLabel('Руководитель',{exact:true}).selectOption('p0');
   await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
   await page.locator('.edit-modal').waitFor({state:'detached'});
   assert.equal(state.employees.find(p=>p.id==='member').managerId,'p0');
   await page.getByRole('button',{name:new RegExp('Бета Тест')}).click();
   assert.match(await page.locator('.profile-fields').textContent(),/РуководительАльфа Тест/);
   assert.equal(await page.locator('.manager-link').evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 0)');
   await page.getByRole('button',{name:'Открыть карточку руководителя: Альфа Тест',exact:true}).click();
   assert.equal(await page.locator('.person-modal h2').textContent(),'Альфа Тест');
   assert.equal(await page.locator('.person-modal').count(),1);
   await page.locator('.person-modal').getByRole('button',{name:'Закрыть',exact:true}).click();
   await page.getByRole('button',{name:new RegExp('Бета Тест')}).click();
   await page.getByRole('button',{name:'Показать подразделение',exact:true}).click();
   await page.getByRole('button',{name:'Показать всех ↗',exact:true}).click();
   await page.getByRole('button',{name:'Управление сотрудниками',exact:true}).click();
   await page.getByRole('tab',{name:'Структура компании',exact:true}).click();
   // Independent roots, nested teams, moving, splitting and safe deletion.
   await page.getByRole('button',{name:'+ Новая структура',exact:true}).click();
   await page.getByLabel('Название',{exact:true}).fill('Новая структура');
   await page.getByRole('button',{name:'Сохранить структуру',exact:true}).click();
   await page.locator('.structure-form').waitFor({state:'detached'});
   const newRoot=state.units.find(u=>u.name==='Новая структура').id;
   await page.getByRole('button',{name:'Добавить внутри: Новая структура',exact:true}).click();
   await page.getByLabel('Название',{exact:true}).fill('Новая ветка');
   await page.getByRole('button',{name:'Сохранить структуру',exact:true}).click();
   await page.locator('.structure-form').waitFor({state:'detached'});
   assert.equal(state.units.find(u=>u.name==='Новая ветка').parent,newRoot);
   await page.locator('.structure-editor').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(output,`structure-editor-${width}.png`)});
   await page.getByRole('button',{name:'Разделить: Отдел маркетинга',exact:true}).click();
   await page.getByLabel('Название',{exact:true}).fill('Выделенная команда');
   await page.getByLabel('Расположение',{exact:true}).selectOption(newRoot);
   await page.getByRole('checkbox',{name:'Бета Тест',exact:true}).check();
   await page.getByRole('button',{name:'Создать и перенести',exact:true}).click();
   await page.locator('.structure-form').waitFor({state:'detached'});
   const split=state.units.find(u=>u.name==='Выделенная команда').id;
   assert.equal(state.employees.find(p=>p.id==='member').unit,split);
   await page.locator('.structure-name').filter({hasText:'Выделенная команда'}).click();
   await page.getByLabel('Название',{exact:true}).fill('Перенесённая команда');
   await page.getByLabel('Расположение',{exact:true}).selectOption('devhead');
   await page.getByRole('button',{name:'Сохранить структуру',exact:true}).click();
   await page.locator('.structure-form').waitFor({state:'detached'});
   assert.equal(state.units.find(u=>u.id===split).parent,'devhead');
   await page.getByRole('button',{name:'Удалить подразделение: Перенесённая команда',exact:true}).click();
   await page.getByRole('button',{name:'Отмена',exact:true}).click();
   assert.ok(state.units.some(u=>u.id===split));
   await page.getByRole('button',{name:'Удалить подразделение: Перенесённая команда',exact:true}).click();
   await page.getByLabel('Перенести в',{exact:true}).selectOption('marketing');
   await page.getByRole('button',{name:'Подтвердить удаление',exact:true}).click();
   await page.locator('.structure-form').waitFor({state:'detached'});
   assert.equal(state.employees.find(p=>p.id==='member').unit,'marketing');
   assert.equal(state.units.some(u=>u.id===split),false);
   await page.getByRole('tab',{name:'Справочник сотрудников',exact:true}).click();
   // Every employee action, including photo upload and both delete decisions.
   await page.locator('.editor-actions').getByRole('button',{name:'+ Добавить сотрудника',exact:true}).click();
   await page.getByLabel('ФИО',{exact:true}).fill('Гамма Тест');
   await page.getByLabel('Подразделение',{exact:true}).selectOption('marketing');
   await page.getByLabel('Должность',{exact:true}).fill('тестовая роль');
   await page.getByRole('textbox',{name:'Местонахождение',exact:true}).fill('Удалённо');
   await page.locator('.admin-photo-upload input').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('synthetic photo')});
   await page.getByRole('button',{name:'Добавить сотрудника',exact:true}).click();
   await page.locator('.edit-modal').waitFor({state:'detached'});
   assert.equal(state.employees.find(p=>p.name==='Гамма Тест').role,'Тестовая роль');
   const newPerson=page.locator('.admin-person').filter({hasText:'Гамма Тест'});
   await newPerson.getByRole('button',{name:'Изменить',exact:true}).click();
   await page.getByLabel('Телефон',{exact:true}).fill('+70000000000');
   await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
   await page.locator('.edit-modal').waitFor({state:'detached'});
   await newPerson.getByRole('button',{name:'Удалить Гамма Тест',exact:true}).click();
   await page.locator('.delete-modal').getByRole('button',{name:'Отмена',exact:true}).click();
   await newPerson.getByRole('button',{name:'Удалить Гамма Тест',exact:true}).click();
   await page.locator('.delete-modal').getByRole('button',{name:'Удалить сотрудника',exact:true}).click();
   await page.locator('.delete-modal').waitFor({state:'detached'});
   assert.equal(state.employees.some(p=>p.name==='Гамма Тест'),false);
   assert.ok(calls.photo&&calls.removePhoto);
   await page.getByRole('button',{name:'Закрыть редактор',exact:true}).click();
   await page.getByRole('tab',{name:'Оргструктура',exact:true}).click();
   await page.getByRole('button',{name:'Новая структура — открыть сотрудников во вкладке «Сотрудники»',exact:true}).click();
   await page.getByRole('button',{name:'Показать всех ↗',exact:true}).click();
   await page.getByRole('button',{name:'Фильтр: Местонахождение',exact:true}).click();
   await page.getByRole('combobox',{name:'Поиск: Местонахождение',exact:true}).fill('Моск');
   await page.getByRole('option',{name:'Москва',exact:true}).click();
   await page.getByRole('button',{name:'Фильтр: Местонахождение',exact:true}).click();
   await page.getByRole('option',{name:'Все местонахождения',exact:true}).click();
   await page.getByRole('button',{name:'БИОсфера — главная',exact:true}).click();
   assert.equal(await page.getByRole('tab',{name:'Оргструктура',exact:true}).getAttribute('aria-selected'),'true');
   await page.getByRole('button',{name:'Выйти',exact:true}).click();
   await page.getByRole('button',{name:'Вход администратора',exact:true}).click();
   await page.getByLabel('Логин',{exact:true}).fill('test');await page.getByLabel('Пароль',{exact:true}).fill('test');
   await page.getByRole('button',{name:'Войти в редактор',exact:true}).click();
   await page.locator('.editor-modal').waitFor();
   assert.deepEqual(errors,[]);
   await page.close();
   // Reset the individual override for the next viewport.
   delete state.employees.find(p=>p.id==='member').managerId;
   console.log(`PASS ${width}px: navigation, filters, cards, all structure actions, employees/photos, login/logout, icons and layout`);
  }
  console.log(`Screenshots: ${output}`);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exit(1)});

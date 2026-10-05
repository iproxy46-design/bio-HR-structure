import {isAdmin,sameOrigin} from "../../../../lib/admin-auth";
import {readOrg,saveOrg,Conflict} from "../../../../lib/org-store";
import {workbook,importWorkbook} from "../../../../lib/employees-excel";
export async function GET(request:Request){
 if(!await isAdmin(request))return Response.json({error:"Недостаточно прав"},{status:403});
 try{
 const url=new URL(request.url),{state}=await readOrg(),template=url.searchParams.has("template");
 const bytes=workbook(state,url.origin,template);
 return new Response(bytes as BodyInit,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${template?"employees-template":"employees"}.xlsx"`,"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Не удалось сформировать Excel"},{status:503})}
}
export async function POST(request:Request){
 if(!sameOrigin(request)||!await isAdmin(request))return Response.json({error:"Недостаточно прав"},{status:403});
 try{
 const form=await request.formData(),file=form.get("file");
 if(!(file instanceof File)||!file.name.toLowerCase().endsWith(".xlsx")||file.size===0||file.size>5_000_000)return Response.json({error:"Выберите .xlsx до 5 МБ"},{status:400});
 const current=await readOrg();if(request.headers.get("If-Match")!==current.revision)throw new Conflict("Данные изменены. Обновите страницу перед импортом.");
 let state;try{state=importWorkbook(await file.arrayBuffer(),current.state)}catch(e){return Response.json({error:e instanceof Error?e.message:"Ошибка Excel"},{status:400})}
 const revision=await saveOrg(state,new URL(request.url).origin,current.revision);return Response.json({state,revision});
 }catch(e){return Response.json({error:e instanceof Conflict?e.message:"Не удалось сохранить Excel"},{status:e instanceof Conflict?409:503})}
}

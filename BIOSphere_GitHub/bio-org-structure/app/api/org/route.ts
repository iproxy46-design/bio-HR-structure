import {isAdmin,sameOrigin} from "../../../lib/admin-auth";
import {validate} from "../../../lib/org";
import {readOrg,saveOrg,Conflict} from "../../../lib/org-store";
export async function GET(request:Request){try{const {state,revision}=await readOrg();return Response.json({state,revision,canEdit:await isAdmin(request)},{headers:{"Cache-Control":"no-store"}})}catch{return Response.json({error:"Не удалось загрузить структуру"},{status:503})}}
export async function PUT(request:Request){
 if(!sameOrigin(request)||!await isAdmin(request))return Response.json({error:"Недостаточно прав"},{status:403});
 try{const body=await request.json();if(!validate(body))return Response.json({error:"Проверьте данные сотрудников"},{status:400});
 const revision=await saveOrg(body,new URL(request.url).origin,request.headers.get("If-Match")||"");return Response.json({ok:true,revision});
 }catch(e){return Response.json({error:e instanceof Conflict?e.message:"Не удалось сохранить изменения"},{status:e instanceof Conflict?409:503})}
}

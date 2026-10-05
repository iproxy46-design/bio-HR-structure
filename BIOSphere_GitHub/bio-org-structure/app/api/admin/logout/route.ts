import {clearSessionCookie,sameOrigin} from "../../../../lib/admin-auth";

export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Недопустимый запрос"},{status:403});
 return Response.json({ok:true},{headers:{"Set-Cookie":clearSessionCookie(request),"Cache-Control":"no-store"}})
}

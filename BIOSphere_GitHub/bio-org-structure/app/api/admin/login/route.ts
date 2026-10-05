import {database} from "../../../../lib/postgres";
import {AdminConfigurationError,sameOrigin,sessionCookie,verifyPassword} from "../../../../lib/admin-auth";
const failure=()=>Response.json({error:"Неверный логин или пароль"},{status:401});
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:"Недопустимый запрос"},{status:403});
 let body:unknown;
 try{body=await request.json()}catch{return Response.json({error:"Некорректный запрос входа"},{status:400})}
 if(!body||typeof body!=="object"||!("username" in body)||!("password" in body)||typeof body.username!=="string"||typeof body.password!=="string"||!body.username||!body.password||body.username.length>100||body.password.length>200)return Response.json({error:"Введите логин и пароль"},{status:400});
 const {username,password}=body;
 let stage="database";
 try{
  const db=database();
  const ip=process.env.TRUST_PROXY==="true"?(request.headers.get("x-forwarded-for")?.split(",")[0].trim()||"local"):"local";
  const row=(await db.query<{failures:number;updated_at:number;blocked_until:number}>("SELECT failures,updated_at,blocked_until FROM login_attempts WHERE ip=$1",[ip])).rows[0];
  const now=Date.now();if(row&&row.blocked_until>now)return Response.json({error:"Слишком много попыток. Повторите через 15 минут"},{status:429});
  stage="password-check";
  if(!(await verifyPassword(username,password))){
   stage="rate-limit";
   const count=row&&now-row.updated_at<15*60*1000?row.failures+1:1;
   await db.query("INSERT INTO login_attempts (ip,failures,updated_at,blocked_until) VALUES ($1,$2,$3,$4) ON CONFLICT(ip) DO UPDATE SET failures=CASE WHEN login_attempts.updated_at > $3-900000 THEN login_attempts.failures+1 ELSE 1 END,updated_at=$3,blocked_until=CASE WHEN login_attempts.updated_at > $3-900000 AND login_attempts.failures+1 >= 5 THEN $3+900000 ELSE 0 END",[ip,count,now,count>=5?now+15*60*1000:0]);
   return failure();
  }
  stage="clear-attempts";
  await db.query("DELETE FROM login_attempts WHERE ip=$1",[ip]);
  stage="session";
  const cookie=await sessionCookie(request);
  return Response.json({ok:true},{headers:{"Set-Cookie":cookie,"Cache-Control":"no-store"}});
 }catch(e){
  console.error("Admin login failed at",stage,e instanceof Error?`${e.name}: ${e.message}`:"Unknown error");
  return Response.json({error:e instanceof AdminConfigurationError?"Вход администратора недоступен: ошибка настройки сервера.":"Вход временно недоступен. Попробуйте позже."},{status:503});
 }
}

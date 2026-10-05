import {database} from "../../../../lib/postgres";
import {isAdmin,sameOrigin} from "../../../../lib/admin-auth";
function valid(id:string){return /^[a-zA-Z0-9_-]{1,100}$/.test(id)}
function typeOf(bytes:Uint8Array){
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return "image/jpeg";
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return "image/png";
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return "image/webp";
 return null;
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!valid(id))return new Response("Invalid id",{status:400});
 try{const result=await database().query<{body:Buffer;content_type:string}>("SELECT body,content_type FROM employee_photos WHERE employee_id=$1",[id]);const obj=result.rows[0];if(!obj)return new Response("Not found",{status:404});return new Response(new Uint8Array(obj.body),{headers:{"Content-Type":obj.content_type||"image/jpeg","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}catch{return new Response("Photo unavailable",{status:503})}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request)||!(await isAdmin(request)))return Response.json({error:"Недостаточно прав"},{status:403});
 const {id}=await params;if(!valid(id))return Response.json({error:"Некорректный ID"},{status:400});
 try{const form=await request.formData(),file=form.get("photo");if(!(file instanceof File)||file.size>5_000_000||file.size===0)return Response.json({error:"Выберите фото JPEG, PNG или WebP до 5 МБ"},{status:400});const bytes=new Uint8Array(await file.arrayBuffer()),contentType=typeOf(bytes);if(!contentType)return Response.json({error:"Поддерживаются JPEG, PNG и WebP"},{status:400});await database().query("INSERT INTO employee_photos(employee_id,body,content_type) VALUES($1,$2,$3) ON CONFLICT(employee_id) DO UPDATE SET body=excluded.body,content_type=excluded.content_type,updated_at=now()",[id,Buffer.from(bytes),contentType]);return Response.json({photoVersion:String(Date.now())})}catch{return Response.json({error:"Не удалось загрузить фото"},{status:503})}
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request)||!(await isAdmin(request)))return Response.json({error:"Недостаточно прав"},{status:403});
 const {id}=await params;if(!valid(id))return Response.json({error:"Некорректный ID"},{status:400});
 try{await database().query("DELETE FROM employee_photos WHERE employee_id=$1",[id]);return new Response(null,{status:204})}catch{return Response.json({error:"Не удалось удалить фото"},{status:503})}
}

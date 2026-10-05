const env=process.env;

function plainHttp(request?:Request){return request?new URL(request.url).protocol==="http:":false}
function cookieName(request?:Request){return plainHttp(request)?"biosfera_admin_local":"__Host-biosfera_admin"}
const enc=new TextEncoder();
const bytes=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const url64=(arr:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(arr))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
export class AdminConfigurationError extends Error {
 constructor(message:string){super(message);this.name="AdminConfigurationError"}
}
function required(name:"ADMIN_USERNAME"|"ADMIN_PASSWORD_RECORD"|"ADMIN_SESSION_KEY"){
 const value=env[name];
 if(typeof value!=="string"||!value.trim())throw new AdminConfigurationError(`Missing ${name} binding. Check the .dev.vars file passed to Wrangler and restart the server.`);
 return value;
}
function secret(){return required("ADMIN_SESSION_KEY")}
function record(){
 const username=required("ADMIN_USERNAME"),value=required("ADMIN_PASSWORD_RECORD");
 const parts=value.split(":");
 try{
  if(parts.length!==2)throw Error();
  const salt=bytes(parts[0]),expected=bytes(parts[1]);
  if(!salt.length||expected.length!==32)throw Error();
  return {username,salt,expected};
 }catch{throw new AdminConfigurationError("Invalid ADMIN_PASSWORD_RECORD: expected base64(salt):base64(PBKDF2-SHA256 hash), 310000 iterations, 32-byte hash.")}
}
async function signer(){return crypto.subtle.importKey("raw",enc.encode(secret()),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
export function sameOrigin(request:Request){
 const origin=request.headers.get("origin");if(!origin)return false;
 const url=new URL(request.url);
 // Next.js can construct request.url with its internal localhost hostname.
 // Host is supplied by the HTTP connection; browsers cannot override it in fetch.
 const host=request.headers.get("host")||url.host;
 const protocol=process.env.TRUST_PROXY==="true"&&request.headers.get("x-forwarded-proto")==="https"?'https:':url.protocol;
 return origin===`${protocol}//${host}`;
}
export async function verifyPassword(username:string,password:string){
 if(!env.ADMIN_PASSWORD_RECORD?.trim()){
  const configured=required("ADMIN_USERNAME");
  secret();
  if(typeof env.ADMIN_PASSWORD!=="string"||!env.ADMIN_PASSWORD)throw new AdminConfigurationError("Missing ADMIN_PASSWORD or ADMIN_PASSWORD_RECORD binding. Configure a password in .dev.vars and restart the server.");
  if(username!==configured)return false;
  // Compare fixed-size digests so password length and the first mismatching
  // character do not affect the comparison loop.
  const [actual,expected]=await Promise.all([password,env.ADMIN_PASSWORD].map(async value=>new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value)))));
  let diff=0;for(let i=0;i<32;i++)diff|=actual[i]^expected[i];
  return diff===0;
 }
 const {username:configured,salt,expected}=record();
 secret();
 if(username!==configured)return false;
 const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
 const actual=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:310000},key,256));
 let diff=0;for(let i=0;i<32;i++)diff|=actual[i]^expected[i];
 return diff===0;
}
function usernameToken(){return url64(enc.encode(required("ADMIN_USERNAME")).buffer)}
export async function sessionCookie(request?:Request){const expiry=Date.now()+12*60*60*1000;const data=`${usernameToken()}.${expiry}`;const signature=url64(await crypto.subtle.sign("HMAC",await signer(),enc.encode(data)));return `${cookieName(request)}=${data}.${signature}; Path=/; HttpOnly;${plainHttp(request)?"":" Secure;"} SameSite=Strict; Max-Age=43200`}
export function clearSessionCookie(request?:Request){return `${cookieName(request)}=; Path=/; HttpOnly;${plainHttp(request)?"":" Secure;"} SameSite=Strict; Max-Age=0`}
export async function isAdmin(request:Request){try{const name=cookieName(request);const cookie=request.headers.get("cookie")?.split(/;\s*/).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1);if(!cookie)return false;const match=cookie.match(/^([a-zA-Z0-9_-]+)\.(\d{13})\.([a-zA-Z0-9_-]+)$/);if(!match||match[1]!==usernameToken()||Number(match[2])<Date.now())return false;const signature=match[3].replace(/-/g,"+").replace(/_/g,"/");const padded=signature+"=".repeat((4-signature.length%4)%4);return await crypto.subtle.verify("HMAC",await signer(),bytes(padded),enc.encode(`${match[1]}.${match[2]}`))}catch{return false}}

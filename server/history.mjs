import { createRemoteJWKSet, jwtVerify } from 'jose';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
let pool;let jwks;
export function database(){if(!pool){if(!process.env.DATABASE_URL)throw Error('Database configuration missing');pool=new pg.Pool({connectionString:process.env.DATABASE_URL.replace(/sslmode=require/,'sslmode=verify-full'),max:5,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});attachDatabasePool(pool);}return pool;}
export async function authenticate(req){
 const header=req.headers.authorization || '';if(!header.startsWith('Bearer '))return null;
 if(!process.env.NEON_AUTH_JWKS_URL || !process.env.NEON_AUTH_BASE_URL)return null;
 jwks ||= createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
 try{const {payload}=await jwtVerify(header.slice(7),jwks,{issuer:new URL(process.env.NEON_AUTH_BASE_URL).origin,algorithms:['EdDSA']});if(typeof payload.sub!=='string' || !/^[0-9a-f-]{36}$/i.test(payload.sub) || payload.isAnonymous || payload.role==='anonymous')return null;const {rows}=await database().query('SELECT id FROM neon_auth."user" WHERE id=$1 AND COALESCE(banned,false)=false',[payload.sub]);return rows.length?payload.sub:null;}catch{return null;}
}
function validate(item){
 if(!item || typeof item.id!=='string' || !/^s[a-zA-Z0-9-]{8,100}$/.test(item.id))return false;
 if(!Array.isArray(item.songs) || !item.songs.length || item.songs.length>500)return false;
 if(!item.songs.every(s=>s && typeof s.song_id==='string' && s.song_id.length<=100 && typeof s.title==='string' && s.title.length<=250 && (s.artist===undefined || typeof s.artist==='string' && s.artist.length<=500)))return false;
 if(typeof item.created_at!=='string' || !Number.isFinite(Date.parse(item.created_at)))return false;
 return item.answers && typeof item.answers==='object' && !Array.isArray(item.answers) && (item.name===undefined || typeof item.name==='string' && item.name.length<=100);
}
export async function withinRequestLimit(user,sql=database()){
 const {rows}=await sql.query('INSERT INTO bajaa_request_limits (user_id,minute,hits) VALUES ($1,date_trunc(\'minute\',now()),1) ON CONFLICT (user_id,minute) DO UPDATE SET hits=bajaa_request_limits.hits+1 RETURNING hits',[user]);
 if(Math.random()<0.02)sql.query("DELETE FROM bajaa_request_limits WHERE minute < now()-interval '1 hour'").catch(()=>{});
 return rows[0].hits<=120;
}
export function createHistoryHandler({verify=authenticate,db=database}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  if(!['GET','POST','DELETE'].includes(req.method)){res.setHeader('Allow','GET, POST, DELETE');return send(405,{error:'Method not allowed'});}
  const user=await verify(req);if(!user)return send(401,{error:'Sign in to access your history.'});
  try{
   const sql=db();
   if(!await withinRequestLimit(user,sql)){res.setHeader('Retry-After','60');return send(429,{error:'Too many history requests. Please wait a minute.'});}
   if(req.method==='GET'){const {rows}=await sql.query('SELECT id, created_at, name, answers, songs FROM bajaa_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',[user]);return send(200,rows);}
   let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body);}catch{return send(400,{error:'Invalid request'});}}
   if(req.method==='POST'){
    if(!validate(body) || JSON.stringify(body).length>200000)return send(400,{error:'Invalid listening session'});
    const result=await sql.query('INSERT INTO bajaa_history (id,user_id,created_at,name,answers,songs) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id,id) DO UPDATE SET name=EXCLUDED.name, answers=EXCLUDED.answers, songs=EXCLUDED.songs RETURNING id',[body.id,user,body.created_at,body.name || '',JSON.stringify(body.answers),JSON.stringify(body.songs)]);
    return send(200,{id:result.rows[0].id});
   }
   if(!body || typeof body.id!=='string')return send(400,{error:'Invalid session identifier'});
   await sql.query('DELETE FROM bajaa_history WHERE user_id=$1 AND id=$2',[user,body.id]);return send(200,{deleted:true});
  }catch(e){console.error('history_request_failed',e.code || e.name);return send(503,{error:'History is temporarily unavailable. Please try again.'});}
 };
}

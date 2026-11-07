require('../scripts/env.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pg=require('pg');
const http=require('node:http');
const puppeteer=require('puppeteer-core');

// The actual Google callback/PKCE/session code runs against an isolated Neon branch.
// Only Google token and certificate responses are mocked; never deployed.
(async()=>{
 process.env.BAJAA_AUTH_MODE='direct';
 if(process.env.BAJAA_AUTH_TEST_DATABASE_URL)process.env.DATABASE_URL=process.env.BAJAA_AUTH_TEST_DATABASE_URL;
 const {database}=await import('../server/history.mjs');const db=database();
 const {directAuth}=await import('../server/direct-auth.mjs');
 const {generateKeyPair,exportJWK,SignJWT}=await import('jose');
 const key=await generateKeyPair('RS256');const jwk=await exportJWK(key.publicKey);jwk.kid='test-google-key';jwk.alg='RS256';
 const id=crypto.randomUUID();const subject='bajaa-test-'+crypto.randomUUID();const email=subject+'@example.invalid';
 const oldFetch=global.fetch;let nonce;let swapped=0;let server;let browser;
 global.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input.url || String(input);
  if(url==='https://oauth2.googleapis.com/token'){
   swapped++;
   const token=await new SignJWT({email,email_verified:true,name:'OAuth regression',nonce}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer('https://accounts.google.com').setAudience(process.env.GOOGLE_CLIENT_ID).setSubject(subject).setIssuedAt().setExpirationTime('5m').sign(key.privateKey);
   return Response.json({access_token:'test-access',token_type:'Bearer',expires_in:3600,id_token:token});
  }
  if(url==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});
  return oldFetch(input,init);
 };
 try{
  await db.query('INSERT INTO bajaa_auth_user(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())',[id,'Existing listener',email]);
  await db.query('INSERT INTO bajaa_auth_account(id,"accountId","providerId","userId","createdAt","updatedAt") VALUES($1,$2,\'google\',$3,now(),now())',[crypto.randomUUID(),subject,id]);
  const migrated=await db.query('SELECT count(*)::int AS count FROM neon_auth."user" n JOIN bajaa_auth_user b ON n.id::text=b.id');assert(migrated.rows[0].count>=0);
  const auth=directAuth();const origin=process.env.BETTER_AUTH_URL;
  const headers={'Content-Type':'application/json',Origin:origin,'x-vercel-forwarded-for':'192.0.2.1'};
  const begin=await auth.handler(new Request(origin+'/api/auth/sign-in/social',{method:'POST',headers,body:JSON.stringify({provider:'google',callbackURL:origin+'/'})}));
  assert.equal(begin.status,200);const url=new URL((await begin.json()).url);nonce=url.searchParams.get('nonce');
  assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),origin+'/api/auth/callback/google');
  const stateCookies=begin.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  assert(stateCookies);console.log('PASS Google request uses BAJAA callback and state cookie');
  const callback=await auth.handler(new Request(origin+'/api/auth/callback/google?code=test-code&state='+encodeURIComponent(url.searchParams.get('state')),{headers:{cookie:stateCookies,'x-vercel-forwarded-for':'192.0.2.1'}}));
  assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),origin+'/');assert.equal(swapped,1);
  const sessionCookies=callback.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const session=await auth.api.getSession({headers:new Headers({cookie:sessionCookies}),query:{disableCookieCache:true}});
  assert.equal(session.user.id,id);assert(!sessionCookies.includes('neon-auth'));console.log('PASS Google callback retains existing account ID and creates BAJAA session');
  const {default:history}=await import('../api/history.mjs');const {default:library}=await import('../api/library.mjs');
  const {default:authRoute}=await import('../api/auth.mjs');
  server=http.createServer(async(req,res)=>{
   let body='';for await(const c of req)body+=c;req.body=body?JSON.parse(body):undefined;if(req.headers.origin===local)req.headers.origin=origin;
   if(req.url.startsWith('/api/auth/'))return authRoute(req,res);
   if(req.url==='/api/library')return library(req,res);
   if(req.url==='/api/history')return history(req,res);
   const target=__dirname+'/../dist'+(req.url==='/'?'/index.html':req.url);
   if(fs.existsSync(target)&&fs.statSync(target).isFile()){res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');return fs.createReadStream(target).pipe(res);}res.statusCode=404;res.end();
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const local='http://localhost:'+server.address().port;
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage();
  await page.evaluateOnNewDocument(fs.readFileSync(__dirname+'/mock-yt.js','utf8'));
  await page.setRequestInterception(true);page.on('request',r=>r.url().endsWith('/config.js')?r.respond({status:200,contentType:'text/javascript',body:'window.BAJAA_CONFIG={authMode:"direct",authUrl:"/api/auth"}'}):r.continue());
  const cookies=callback.headers.getSetCookie().map(c=>{const pair=c.split(';')[0];const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),domain:'localhost',path:'/',secure:true,httpOnly:true,sameSite:'Lax'};});
  await browser.setCookie(...cookies);await page.goto(local);await page.waitForSelector('.choice-card');assert.equal(await page.evaluate(()=>BAJAAAccount.user.id),id);
  const item={id:'s'+crypto.randomUUID(),name:'Direct auth',answers:{},created_at:new Date().toISOString(),songs:[{song_id:'test-track',title:'Track'}]};
  assert.equal(await page.evaluate(item=>BAJAAAccount.save(item),item),true);assert.equal((await page.evaluate(()=>BAJAAAccount.list()))[0].id,item.id);
  console.log('PASS real Better Auth browser client opens room and saves/reads history with HttpOnly cookie');
  const signout=await auth.handler(new Request(origin+'/api/auth/sign-out',{method:'POST',headers:{...headers,cookie:sessionCookies},body:'{}'}));assert.equal(signout.status,200);
  const expired=await auth.api.getSession({headers:new Headers({cookie:sessionCookies}),query:{disableCookieCache:true}});assert.equal(expired,null);console.log('PASS sign-out revokes database session');
  const bad=await auth.handler(new Request(origin+'/api/auth/callback/google?code=test-code&state=wrong',{headers:{cookie:stateCookies,'x-vercel-forwarded-for':'192.0.2.1'}}));assert.equal(bad.status,302);assert.equal(swapped,1);console.log('PASS invalid OAuth state is rejected before token exchange');
 }finally{
  global.fetch=oldFetch;if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));
  await db.query('DELETE FROM bajaa_history WHERE user_id=$1',[id]);await db.query('DELETE FROM bajaa_request_limits WHERE user_id=$1',[id]);await db.query('DELETE FROM bajaa_auth_user WHERE id=$1',[id]);await db.end();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

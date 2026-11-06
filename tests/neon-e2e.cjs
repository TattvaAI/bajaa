require('../scripts/env.cjs');const assert=require('node:assert/strict');const http=require('node:http');
(async()=>{const {createHistoryHandler,database}=await import('../server/history.mjs');const db=database();
const suffix=crypto.randomUUID(),a='bajaa-test-a-'+suffix,b='bajaa-test-b-'+suffix;const id='s'+suffix;
// Test identities injected only into this in-process test server. Production verifies Neon JWTs.
const handler=createHistoryHandler({verify:async req=>req.headers['x-test-user'] || null});
const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;req.body=body?JSON.parse(body):undefined;await handler(req,res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const call=async(method,user,body)=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(user?{'x-test-user':user}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
try{
assert.equal((await call('GET')).status,401);console.log('PASS history API rejects unauthenticated requests');
const item={id,created_at:new Date().toISOString(),name:'Neon end-to-end check',answers:{languages:['hindi'],time:'peak',crowd:'medium'},songs:[{song_id:'test-song',title:'Test song',artist:'Test artist'}]};
assert.equal((await call('POST',a,item)).status,200);assert.equal((await call('GET',a)).body[0].id,id);assert.deepEqual((await call('GET',b)).body,[]);console.log('PASS API → live Neon Postgres → persisted history; second identity cannot read it');
assert.equal((await call('POST',a,{...item,name:'Updated'})).status,200);assert.equal((await call('GET',a)).body.length,1);console.log('PASS session updates do not duplicate history');
assert.equal((await call('DELETE',b,{id})).status,200);assert.equal((await call('GET',a)).body.length,1);assert.equal((await call('DELETE',a,{id})).status,200);assert.equal((await call('GET',a)).body.length,0);console.log('PASS owner-only deletion and read-back from Neon');
assert.equal((await call('POST',a,{id:'invalid'})).status,400);console.log('PASS malformed history rejected');
const r=await fetch(process.env.NEON_AUTH_JWKS_URL);assert(r.ok);const keys=await r.json();assert(keys.keys?.length);console.log('PASS live Neon Auth JWKS reachable');
const actual=await fetch((process.env.BAJAA_TEST_URL || 'http://localhost:8000')+'/api/history',{headers:{Authorization:'Bearer forged-token'}});assert.equal(actual.status,401);console.log('PASS running app rejects forged Neon access token');
}finally{await db.query('DELETE FROM bajaa_history WHERE user_id=ANY($1)',[[a,b]]);await new Promise(r=>server.close(r));await db.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

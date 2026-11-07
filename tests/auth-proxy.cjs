const assert = require('node:assert/strict');
(async()=>{
  process.env.NEON_AUTH_BASE_URL='https://unreachable.example.invalid/auth';
  process.env.NEON_AUTH_COOKIE_SECRET='test-only-cookie-secret-with-more-than-32-characters';
  const {default:handler}=await import('../api/auth.mjs');
  const original=global.fetch;let upstream=0;
  global.fetch=async()=>{upstream++;return Response.json({session:null,user:null});};
  const call=async(suffix='',cookie)=>{
    const headers={host:'localhost:8000',...(cookie?{cookie}:{})};
    let body;const res={statusCode:200,setHeader(){},end:value=>{body=JSON.parse(String(value));}};
    await handler({url:'/api/auth/get-session'+suffix,method:'GET',headers},res);
    return {status:res.statusCode,body};
  };
  try{
    assert.deepEqual((await call()).body,{session:null,user:null});assert.equal(upstream,0);
    await call('','unrelated=abc');assert.equal(upstream,0);
    console.log('PASS signed-out session check performs zero upstream auth requests');
    await call('?neon_auth_session_verifier=test');assert.equal(upstream,1);
    await call('','__Secure-neon-auth.session_challenge=test');assert.equal(upstream,2);
    console.log('PASS OAuth verifier and challenge are forwarded rather than mistaken for signed-out visitors');
  }finally{global.fetch=original;}
})().catch(error=>{console.error(error);process.exitCode=1;});

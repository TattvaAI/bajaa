const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const fs=require('node:fs');
const vm=require('node:vm');
const base=process.env.BAJAA_TEST_URL || 'http://localhost:8000';

// Use the real installed Neon SDK/account bundle, only stub network responses.
// This catches token() accidentally returning Neon 0.8.2's cached session envelope.
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
  const page=await browser.newPage();
  const payload=Buffer.from(JSON.stringify({sub:'10000000-0000-4000-8000-000000000001',exp:Math.floor(Date.now()/1000)+900})).toString('base64url');
  const token='eyJhbGciOiJFZERTQSJ9.'+payload+'.test-signature';
  const date=new Date().toISOString();
  const user={id:'10000000-0000-4000-8000-000000000001',name:'Regression listener',email:'test@example.invalid',emailVerified:true,createdAt:date,updatedAt:date};
  const session={id:'test-session',userId:user.id,token,expiresAt:new Date(Date.now()+86400000).toISOString(),createdAt:date,updatedAt:date};
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../seed.js','utf8'),ctx);
  const errors=[];let protectedRequests=0;let signOutCompleted=false;page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(fs.readFileSync(__dirname+'/mock-yt.js','utf8'));
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const url=new URL(request.url());
   const respond=body=>request.respond({status:200,contentType:'application/json',headers:{'set-auth-jwt':token},body:JSON.stringify(body)});
   if(url.pathname==='/api/auth/get-session')return respond({session,user});
   if(url.pathname==='/api/auth/token')return respond({token});
   if(url.pathname==='/api/auth/sign-out'){setTimeout(()=>{signOutCompleted=true;respond({success:true});},1500);return;}
   if(['/api/session','/api/library','/api/history'].includes(url.pathname)){
    assert.equal(request.headers().authorization,'Bearer '+token);
    protectedRequests++;
    return respond(url.pathname==='/api/library'?ctx.window.BAJAA_LIBRARY:url.pathname==='/api/history'?[]:{id:user.id});
   }
   request.continue();
  });
  await page.goto(base);await page.waitForSelector('.choice-card');
  assert.equal(await page.evaluate(()=>BAJAAAccount.authorize()),true);
  assert.equal(await page.evaluate(()=>BAJAAAccount.authorize()),true);
  assert.equal(await page.evaluate(()=>BAJAAAccount.verified),true);
  assert(protectedRequests>=3);assert.deepEqual(errors,[]);
  console.log('PASS real Neon SDK cached session supplies JWT to repeated authorization, library and history requests');
  await page.goto(base+'/sets/');await page.waitForSelector('.account-panel button');
  await page.click('.account-panel button');await page.waitForSelector('.signin-page .bajaa-button');
  assert.equal(signOutCompleted,false,'sign-in screen appears before slow upstream sign-out completes');
  assert.equal(await page.evaluate(()=>BAJAAAccount.user),null);
  await page.waitForFunction(()=>!document.querySelector('.sets-page'));
  assert.deepEqual(errors,[]);
  console.log('PASS real SDK sign-out locks History and shows sign-in before delayed upstream response');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Execute the shipped adapter; defer network completion to exercise real races.
const tick = () => new Promise(resolve => setImmediate(resolve));
const item = (version = 1) => ({id:'squeue-regression',created_at:'2026-11-07T00:00:00Z',name:'Room',answers:{},songs:[{song_id:'track'+version,title:'Track '+version}]});
async function fixture() {
  const events = new EventTarget();
  const storage = new Map();
  const cloud = new Map();
  const timers = new Map();
  const requests = [];
  let timerID = 0;
  let channel;
  let signOutDone;
  let authSessionDone;
  let holdSession = false;
  const token = 'header.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+900})).toString('base64url')+'.signature';
  const auth = {
    getSession:async()=>holdSession ? new Promise(resolve=>{authSessionDone=()=>resolve({data:{session:{token},user:{id:'owner-a'}}});}) : {data:{session:{token},user:{id:'owner-a'}}},
    signOut:()=>new Promise(resolve=>{signOutDone=()=>resolve({});}),
  };
  const localStorage = {
    getItem:key=>storage.get(key) ?? null,
    setItem:(key,value)=>storage.set(key,value),
    removeItem:key=>storage.delete(key),
  };
  const window = {BAJAA_CONFIG:{authUrl:'/api/auth'},dispatchEvent:event=>events.dispatchEvent(event),addEventListener:(...args)=>events.addEventListener(...args)};
  const sandbox = {window,createAuthClient:()=>auth,location:{origin:'https://bajaa.test'},URL,Event,CustomEvent,localStorage,sessionStorage:localStorage,atob,console,
    setTimeout:fn=>{timers.set(++timerID,fn);return timerID;},clearTimeout:id=>timers.delete(id),
    BroadcastChannel:class {constructor(){channel=this;}addEventListener(type,fn){this.receive=fn;}postMessage(){}},
    fetch:(url,options)=>new Promise(resolve=>{
      const body=options.body && JSON.parse(options.body);
      const request={url,method:options.method,body,finish:(status=200)=>{
        if(status===200){if(options.method==='POST')cloud.set(body.id,body);if(options.method==='DELETE'){if(url==='/api/account')cloud.clear();else cloud.delete(body.id);}}
        resolve({ok:status===200,status,json:async()=>options.method==='GET'?[...cloud.values()]:status===200?{}:{error:'Offline'}});
      }};
      requests.push(request);
    }),
  };
  vm.runInNewContext(fs.readFileSync(__dirname+'/../account.js','utf8').replace("import { createAuthClient } from '@neon/auth';",'').replace("import { createAuthClient as createDirectAuthClient } from 'better-auth/client';",''),sandbox);
  await window.BAJAAAccount.ready;
  return {account:window.BAJAAAccount,storage,cloud,requests,timers,window,channel,holdSession:()=>{holdSession=true;},finishSession:()=>authSessionDone(),finishSignOut:()=>signOutDone()};
}

(async()=>{
  {
    const f=await fixture();
    const first=f.account.save(item(1));await tick();f.requests[0].finish(503);await first;
    f.window.dispatchEvent(new Event('online'));await tick();
    assert.equal(f.requests[1].body.songs[0].title,'Track 1');
    const newer=f.account.save(item(2));await tick();
    assert.equal(f.requests.length,2,'new save waits for flush');
    f.requests[1].finish();await tick();
    assert.equal(f.requests[2].body.songs[0].title,'Track 2');
    f.requests[2].finish(503);await newer;
    const pending=JSON.parse(f.storage.get('bajaa.pending.owner-a'));
    assert.equal(pending[0].songs[0].title,'Track 2','old acknowledgement retains newer failed save');
    f.window.dispatchEvent(new Event('online'));await tick();f.requests[3].finish();await tick();
    assert.equal(f.cloud.get(item().id).songs[0].title,'Track 2');
    console.log('PASS deferred retry preserves and eventually syncs the newest offline save');
  }
  {
    const f=await fixture();f.storage.set('bajaa.history.owner-a',JSON.stringify([item()]));
    const listing=f.account.list();await tick();f.requests[0].finish();const rows=await listing;
    assert.equal(rows.length,0,'successful cloud read removes a remotely deleted local cache entry');
    assert.equal(JSON.parse(f.storage.get('bajaa.history.owner-a')).length,0);
    console.log('PASS cloud deletion removes stale history from another browser cache');
  }
  for(const bulk of [false,true]){
    const f=await fixture();const saving=f.account.save(item());await tick();
    const removing=bulk?f.account.deleteHistory():f.account.remove(item().id);await tick();
    assert.equal(f.requests.length,1,'deletion waits for in-flight save');
    assert.equal(await f.account.save(item(2)),false,'delete barrier rejects stale session saves');
    f.requests[0].finish();await saving;await tick();
    assert.equal(f.requests[1].method,'DELETE');f.requests[1].finish();await removing;
    f.window.dispatchEvent(new Event('online'));await tick();
    assert.equal(f.requests.length,2,'no retry resurrects deleted history');
    assert.equal(f.cloud.size,0);assert.equal(await f.account.save(item(3)),false);
    console.log('PASS '+(bulk?'bulk history':'single session')+' deletion cannot be undone by an in-flight save or retry');
  }
  {
    const f=await fixture();const saving=f.account.save(item());await tick();
    const queued=f.account.save({...item(2),id:'ssecond-queue'});await tick();
    const before=f.storage.get('bajaa.pending.owner-a');
    const signout=f.account.signOut();assert.equal(f.account.user,null,'room locks before upstream signout resolves');
    f.requests[0].finish();await saving;await queued;
    assert.equal(f.requests.length,1,'queued writes stop after signout');
    assert.equal(f.storage.get('bajaa.pending.owner-a'),before,'late responses cannot modify another account cache');
    f.finishSignOut();await signout;assert.equal(f.timers.size,0);
    console.log('PASS sign-out immediately locks the room and invalidates late writes and timers');
  }
  {
    const f=await fixture();f.holdSession();const saving=f.account.save(item());await tick();
    f.channel.receive({data:'signout'});f.finishSession();await saving;
    assert.equal(f.requests.length,0,'no request starts with a token resolved after cross-tab signout');
    console.log('PASS cross-tab sign-out cancels writes still waiting for a token');
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

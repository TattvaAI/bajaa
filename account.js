/* Account adapter uses managed Neon Auth. The database is never called by the browser. */
import { createAuthClient } from '@neon/auth';
const authUrl=window.BAJAA_CONFIG?.authUrl;
const auth=authUrl?createAuthClient(new URL(authUrl,location.origin).href):null;
let user=null;let verified=false;let roomLibrary=null;let roomRequest=null;
let operationChain=Promise.resolve();let retryTimer;let retryDelay=5000;let syncStatus='synced';
let epoch=0;let deletingAll=false;let signOutRequest=null;let signOutFailed=false;const retired=new Set();
const context=()=>({owner:user?.id,epoch});
const current=c=>!!c.owner && user?.id===c.owner && epoch===c.epoch;
const enqueue=work=>{const result=operationChain.catch(()=>{}).then(work);operationChain=result;return result;};
function lockAccount(){epoch++;clearTimeout(retryTimer);user=null;verified=false;roomLibrary=null;retired.clear();deletingAll=false;setSync('synced');emit();}
const setSync=value=>{syncStatus=value;window.dispatchEvent(new Event('bajaa:sync'));};
const emit=()=>window.dispatchEvent(new Event('bajaa:account'));
const accountChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('bajaa-account'):null;
accountChannel?.addEventListener('message',e=>{if(e.data==='signout'){lockAccount();}});
const error=message=>window.dispatchEvent(new CustomEvent('bajaa:account-error',{detail:{message}}));
const historyKey=()=>user?'bajaa.history.'+user.id:'naux.sets';
function read(){try{const a=JSON.parse(localStorage.getItem(historyKey()) || '[]');return Array.isArray(a)?a.filter(x=>x && typeof x.id==='string' && Array.isArray(x.songs)).slice(0,100):[];}catch{return[];}}
const pendingKey=()=>user?'bajaa.pending.'+user.id:null;
function pending(){try{const rows=JSON.parse(localStorage.getItem(pendingKey()) || '[]');return Array.isArray(rows)?rows:[];}catch{return[];}}
function setPending(rows){try{if(pendingKey())localStorage.setItem(pendingKey(),JSON.stringify(rows.slice(0,100)));return true;}catch{setSync('pending');return false;}}
function acknowledge(item){const queued=pending().find(x=>x.id===item.id);if(JSON.stringify(queued)===JSON.stringify(item))setPending(pending().filter(x=>x.id!==item.id));}
function write(rows){try{localStorage.setItem(historyKey(),JSON.stringify(rows.slice(0,100)));return true;}catch{error('History could not be saved on this device.');return false;}}
async function accessToken(){
 // Neon injects the signed JWT into session.token. In 0.8.2, token() can
 // return the cached session object instead of {token}; don't use it here.
 const session=await auth.getSession();
 if(session.error)throw Error('Your sign-in could not be restored. Please sign in again.');
 const cached=session.data?.session?.token;
 if(typeof cached==='string' && cached.split('.').length===3){
  try{const claims=JSON.parse(atob(cached.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(claims.exp*1000>Date.now()+30000)return cached;}catch{}
 }
 const r=await fetch(new URL(authUrl+'/token',location.origin),{credentials:'same-origin',cache:'no-store'});
 const data=await r.json();
 if(!r.ok || typeof data.token!=='string')throw Error('Your sign-in has expired. Please sign in again.');
 return data.token;
}
async function api(method,item,c=context()){
 if(!current(c))throw Error('Account changed.');
 const token=await accessToken();
 if(!current(c))throw Error('Account changed.');
 const r=await fetch('/api/history',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:item?JSON.stringify(item):undefined});
 const body=await r.json();if(!current(c))throw Error('Account changed.');if(!r.ok)throw Error(body.error || 'History sync failed.');return body;
}
async function list(){
 await ready;const c=context();if(!current(c))return [];
 return enqueue(async()=>{
  if(!current(c))return [];
  const local=read();
  try{const cloud=await api('GET',undefined,c);const merged=[...new Map([...local,...cloud,...pending()].filter(x=>!retired.has(x.id)).map(x=>[x.id,x])).values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,100);write(merged);return merged;}
  catch{if(!current(c))return [];setSync('pending');return local;}
 });
}
function normalize(item){return {...item,name:String(item.name || '').slice(0,100),songs:item.songs.slice(-500)};}
function retrySoon(){clearTimeout(retryTimer);if(!user)return;retryTimer=setTimeout(flushPending,retryDelay);retryDelay=Math.min(60000,retryDelay*2);}
async function flushPending(){
 const c=context();if(!current(c) || deletingAll)return;
 return enqueue(async()=>{
  if(!current(c) || deletingAll)return;
  try{for(const item of pending()){
   if(!current(c) || deletingAll)return;
   if(retired.has(item.id))continue;
   await api('POST',normalize(item),c);acknowledge(item);
  }retryDelay=5000;setSync(pending().length?'pending':'synced');}
  catch{if(current(c)){setSync('pending');retrySoon();}}
 });
}
async function importLocal(){
 const c=context();if(!current(c) || deletingAll)return;
 await enqueue(async()=>{
  if(!current(c) || deletingAll)return;
  try{const cloud=await api('GET',undefined,c);const known=new Set(cloud.map(x=>x.id));let guest=[];try{guest=JSON.parse(localStorage.getItem('naux.sets') || '[]');}catch{}
   for(const item of [...read(),...(Array.isArray(guest)?guest:[])])if(!known.has(item.id) && !retired.has(item.id) && !deletingAll){setPending([normalize(item),...pending().filter(x=>x.id!==item.id)]);known.add(item.id);}
  }catch{if(current(c))setSync('pending');}
 });
 return flushPending();
}
const ready=(async()=>{if(!auth)return;try{const session=await auth.getSession();if(session.error)throw session.error;user=session.data?.user || null;emit();}catch{error('Sign-in could not be restored. Please try signing in again.');emit();}})();
function syncLater(){if(user)setTimeout(importLocal,1200);}
window.BAJAAAccount={ready,configured:!!auth,get user(){return user;},get verified(){return verified;},get syncStatus(){return syncStatus;},list,
 async openRoom(){await ready;if(!user || !auth)return false;const c=context();if(roomLibrary){verified=true;return true;}if(roomRequest)return roomRequest;roomRequest=(async()=>{try{const token=await accessToken();if(!current(c))return false;const r=await fetch('/api/library',{headers:{Authorization:'Bearer '+token}});if(!current(c))return false;if(!r.ok){if(r.status===401){lockAccount();}throw Error('Could not open your room. Please try signing in again.');}const library=await r.json();if(!current(c))return false;roomLibrary=library;verified=true;syncLater();return true;}catch(e){error(e.message);return false;}finally{roomRequest=null;}})();return roomRequest;},
 async authorize(){await ready;if(!user || !auth)return false;const c=context();try{const token=await accessToken();if(!current(c))return false;const r=await fetch('/api/session',{headers:{Authorization:'Bearer '+token}});if(!current(c))return false;verified=r.ok;if(r.status===401){lockAccount();error('Your sign-in has expired. Please continue with Google again.');}else if(!r.ok)error('Sign-in verification is temporarily unavailable. Please try again.');return verified;}catch(e){error(e.message || 'Sign-in verification failed. Please try again.');return false;}},
 async library(){if(!await this.openRoom())return null;return roomLibrary;},
 async signIn(returnTo='/'){if(signOutRequest)await signOutRequest;if(signOutFailed && !await this.signOut())return false;sessionStorage.setItem('bajaa.returnTo',returnTo);if(!auth){error('Google sign-in is being configured.');return false;}try{const r=await auth.signIn.social({provider:'google',callbackURL:location.origin+'/'});if(r.error)throw r.error;return true;}catch(e){error(e.message || 'Google sign-in failed.');return false;}},
 async signOut(){
  if(!auth)return;if(signOutRequest)return signOutRequest;lockAccount();accountChannel?.postMessage('signout');
  // Stop playback immediately; retain the promise so a new login cannot race cookie clearing.
  signOutRequest=(async()=>{try{const r=await auth.signOut();if(r.error)throw r.error;signOutFailed=false;return true;}catch{signOutFailed=true;error('You are signed out of this room. Server sign-out failed; please retry before closing this browser.');return false;}})();
  const result=await signOutRequest;signOutRequest=null;return result;
 },
 async save(item){
  await ready;const c=context();if(!current(c) || deletingAll || retired.has(item.id))return false;
  item=normalize(item);write([item,...read().filter(x=>x.id!==item.id)]);setPending([item,...pending().filter(x=>x.id!==item.id)]);setSync('saving');
  return enqueue(async()=>{
   if(!current(c) || deletingAll || retired.has(item.id))return false;
   // Newer pending saves supersede queued snapshots before network work starts.
   const queued=pending().find(x=>x.id===item.id);if(queued && JSON.stringify(queued)!==JSON.stringify(item))return false;
   try{await api('POST',item,c);acknowledge(item);setSync(pending().length?'saving':'synced');return true;}
   catch{if(current(c)){setSync('pending');retrySoon();}return false;}
  });
 },
 async exportHistory(){return this.list();},
 async deleteHistory(){
  await ready;const c=context();if(!current(c))throw Error('Sign in to delete history.');
  deletingAll=true;clearTimeout(retryTimer);
  try{return await enqueue(async()=>{
   if(!current(c))throw Error('Account changed.');
   const token=await accessToken();if(!current(c))throw Error('Account changed.');
   const r=await fetch('/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({confirm:true})});
   const data=await r.json();if(!current(c))throw Error('Account changed.');if(!r.ok)throw Error(data.error || 'History deletion failed.');
   for(const item of read())retired.add(item.id);
   localStorage.removeItem(historyKey());localStorage.removeItem(pendingKey());localStorage.removeItem('naux.sets');setSync('synced');
  });}finally{if(current(c)){deletingAll=false;if(pending().length)retrySoon();}}
 },
 async remove(id){
  await ready;const c=context();if(!current(c))return false;
  retired.add(id);
  return enqueue(async()=>{
   if(!current(c))return false;
   try{await api('DELETE',{id},c);setPending(pending().filter(x=>x.id!==id));
    const old=JSON.parse(localStorage.getItem('naux.sets') || '[]');localStorage.setItem('naux.sets',JSON.stringify(old.filter(x=>x.id!==id)));
    const result=write(read().filter(x=>x.id!==id));setSync(pending().length?'pending':'synced');return result;
   }catch(e){if(current(c)){retired.delete(id);error(e.message);if(pending().length)retrySoon();}return false;}
  });
 }

};

window.dispatchEvent(new Event('bajaa:account-ready'));
window.addEventListener('online',()=>{retryDelay=5000;flushPending();});

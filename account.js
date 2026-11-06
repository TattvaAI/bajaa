/* Account adapter uses managed Neon Auth. The database is never called by the browser. */
import { createAuthClient } from '@neon/auth';
const authUrl=window.BAJAA_CONFIG?.authUrl;
const auth=authUrl?createAuthClient(new URL(authUrl,location.origin).href):null;
let user=null;let syncing=false;let verified=false;let roomLibrary=null;let roomRequest=null;
let saveChain=Promise.resolve();let retryTimer;let retryDelay=5000;let syncStatus='synced';
const setSync=value=>{syncStatus=value;window.dispatchEvent(new Event('bajaa:sync'));};
const emit=()=>window.dispatchEvent(new Event('bajaa:account'));
const accountChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('bajaa-account'):null;
accountChannel?.addEventListener('message',e=>{if(e.data==='signout'){user=null;verified=false;roomLibrary=null;emit();}});
const error=message=>window.dispatchEvent(new CustomEvent('bajaa:account-error',{detail:{message}}));
const historyKey=()=>user?'bajaa.history.'+user.id:'naux.sets';
function read(){try{const a=JSON.parse(localStorage.getItem(historyKey()) || '[]');return Array.isArray(a)?a.filter(x=>x && typeof x.id==='string' && Array.isArray(x.songs)).slice(0,100):[];}catch{return[];}}
const pendingKey=()=>user?'bajaa.pending.'+user.id:null;
function pending(){try{const rows=JSON.parse(localStorage.getItem(pendingKey()) || '[]');return Array.isArray(rows)?rows:[];}catch{return[];}}
function setPending(rows){if(pendingKey())localStorage.setItem(pendingKey(),JSON.stringify(rows.slice(0,100)));}
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
async function api(method,item){
 const token=await accessToken();
 const r=await fetch('/api/history',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:item?JSON.stringify(item):undefined});
 const body=await r.json();if(!r.ok)throw Error(body.error || 'History sync failed.');return body;
}
async function list(){
 const local=read();if(!user)return [];
 try{const cloud=await api('GET');const merged=[...new Map([...local,...cloud].map(x=>[x.id,x])).values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,100);write(merged);return merged;}
 catch(e){error('Cloud history is unavailable. Your saved sessions are still on this device.');return local;}
}
function normalize(item){return {...item,name:String(item.name || '').slice(0,100),songs:item.songs.slice(-500)};}
function retrySoon(){clearTimeout(retryTimer);if(!user)return;retryTimer=setTimeout(flushPending,retryDelay);retryDelay=Math.min(60000,retryDelay*2);}
async function flushPending(){if(syncing || !user)return;syncing=true;try{for(const item of pending()){await api('POST',normalize(item));setPending(pending().filter(x=>x.id!==item.id));}retryDelay=5000;setSync('synced');}catch{setSync('pending');retrySoon();}finally{syncing=false;}}
async function importLocal(){if(syncing || !user)return;syncing=true;try{const cloud=await api('GET');const known=new Set(cloud.map(x=>x.id));let guest=[];try{guest=JSON.parse(localStorage.getItem('naux.sets') || '[]');}catch{}for(const item of [...read(),...(Array.isArray(guest)?guest:[])])if(!known.has(item.id)){setPending([normalize(item),...pending().filter(x=>x.id!==item.id)]);known.add(item.id);}}catch{setSync('pending');}finally{syncing=false;flushPending();}}
const ready=(async()=>{if(!auth)return;try{const session=await auth.getSession();if(session.error)throw session.error;user=session.data?.user || null;emit();}catch{error('Sign-in could not be restored. Please try signing in again.');emit();}})();
function syncLater(){if(user)setTimeout(importLocal,1200);}
window.BAJAAAccount={ready,configured:!!auth,get user(){return user;},get verified(){return verified;},get syncStatus(){return syncStatus;},list,
 async openRoom(){await ready;if(!user || !auth)return false;if(roomLibrary){verified=true;return true;}if(roomRequest)return roomRequest;roomRequest=(async()=>{try{const token=await accessToken();const r=await fetch('/api/library',{headers:{Authorization:'Bearer '+token}});if(!r.ok){if(r.status===401){user=null;verified=false;emit();}throw Error('Could not open your room. Please try signing in again.');}roomLibrary=await r.json();verified=true;syncLater();return true;}catch(e){error(e.message);return false;}finally{roomRequest=null;}})();return roomRequest;},
 async authorize(){await ready;if(!user || !auth)return false;try{const token=await accessToken();const r=await fetch('/api/session',{headers:{Authorization:'Bearer '+token}});verified=r.ok;if(r.status===401){user=null;verified=false;emit();error('Your sign-in has expired. Please continue with Google again.');}else if(!r.ok)error('Sign-in verification is temporarily unavailable. Please try again.');return verified;}catch(e){error(e.message || 'Sign-in verification failed. Please try again.');return false;}},
 async library(){if(!await this.openRoom())return null;return roomLibrary;},
 async signIn(returnTo='/'){sessionStorage.setItem('bajaa.returnTo',returnTo);if(!auth){error('Google sign-in is being configured.');return false;}try{const r=await auth.signIn.social({provider:'google',callbackURL:location.origin+'/'});if(r.error)throw r.error;return true;}catch(e){error(e.message || 'Google sign-in failed.');return false;}},
 async signOut(){if(!auth)return;try{const r=await auth.signOut();if(r.error)throw r.error;user=null;verified=false;roomLibrary=null;accountChannel?.postMessage('signout');emit();}catch{error('Sign-out failed. Please try again.');}},
 async save(item){await ready;item=normalize(item);const rows=read();write([item,...rows.filter(x=>x.id!==item.id)]);if(!user)return false;setPending([item,...pending().filter(x=>x.id!==item.id)]);setSync('saving');const owner=user.id;const work=saveChain.catch(()=>{}).then(async()=>{if(user?.id!==owner)return false;try{await api('POST',item);const queued=pending().find(x=>x.id===item.id);if(JSON.stringify(queued)===JSON.stringify(item))setPending(pending().filter(x=>x.id!==item.id));setSync(pending().length?'saving':'synced');return true;}catch{setSync('pending');retrySoon();return false;}});saveChain=work;return work;},
 async exportHistory(){return this.list();},
 async deleteHistory(){await ready;const token=await accessToken();const r=await fetch('/api/account',{method:'DELETE',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({confirm:true})});const data=await r.json();if(!r.ok)throw Error(data.error || 'History deletion failed.');localStorage.removeItem(historyKey());localStorage.removeItem(pendingKey());localStorage.removeItem('naux.sets');setSync('synced');},
 async remove(id){if(user){try{await api('DELETE',{id});}catch(e){error(e.message);return false;}}try{setPending(pending().filter(x=>x.id!==id));const old=JSON.parse(localStorage.getItem('naux.sets') || '[]');localStorage.setItem('naux.sets',JSON.stringify(old.filter(x=>x.id!==id)));}catch{}return write(read().filter(x=>x.id!==id));}
};

window.dispatchEvent(new Event('bajaa:account-ready'));
window.addEventListener('online',()=>{retryDelay=5000;flushPending();});

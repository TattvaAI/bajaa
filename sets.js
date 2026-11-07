(() => {
  'use strict';const {el,nav,footer,notice}=window.BAJAADesign;const app=document.getElementById('app');let version=0;let removeSyncListener=()=>{};
  const read=()=>{try{const a=JSON.parse(localStorage.getItem('naux.sets') || '[]');return Array.isArray(a)?a.filter(s=>s && typeof s.id==='string' && Array.isArray(s.songs)):[];}catch{return[];}};
  async function render() {
    if(!window.BAJAAAccount?.verified)return;
    removeSyncListener();const v=++version;const account=window.BAJAAAccount;const sets=await(account?.list() || Promise.resolve(read()));if(v!==version || !account.verified)return;
    const main=el('main',{class:'sets-page'},nav('sets'),el('h1',{},'Good nights, remembered.'),el('p',{class:'sets-intro'},'Your sessions save themselves. Come back when you feel like an encore.'));
    const panel=el('section',{class:'account-panel','aria-label':'Your account'},el('p',{},account?.user?'Signed in. Your listening history syncs across devices.':account?.configured?'Sign in with Google to keep your listening history with you. Sign-in is required to listen.':'Account connection is unavailable. Please try again.'),
      el('button',{class:account?.user?'text-button':'bajaa-button primary',disabled:!account?.configured,onclick:async()=>{if(account.user)await account.signOut();else await account.signIn();}},account?.user?'Sign out':'Continue with Google'));
    const sync=el('p',{class:'history-sync-status',role:'status'},account.syncStatus==='pending'?'Saved on this device · retrying cloud sync':'History sync connected');
    const updateSync=()=>{if(sync.isConnected)sync.textContent=account.syncStatus==='pending'?'Saved on this device · retrying cloud sync':account.syncStatus==='saving'?'Saving history…':'History sync connected';};
    window.addEventListener('bajaa:sync',updateSync);removeSyncListener=()=>window.removeEventListener('bajaa:sync',updateSync);
    panel.append(sync);main.append(panel);
    const exportButton=el('button',{class:'text-button',onclick:async()=>{exportButton.disabled=true;try{const rows=await account.exportHistory();const url=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}));const a=el('a',{href:url,download:'bajaa-listening-history.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}finally{exportButton.disabled=false;}}},'Export history ↓');
    const clear=el('button',{class:'text-button',onclick:async()=>{if(clear.dataset.confirm){clear.disabled=true;try{await account.deleteHistory();render();}catch(e){notice(e.message);clear.disabled=false;}return;}clear.dataset.confirm='yes';clear.textContent='Confirm: delete all history';}},'Delete all history');
    main.append(el('div',{class:'account-data-actions'},exportButton,clear,el('a',{class:'text-button',href:'mailto:contact@interncell.com?subject=BAJAA%20account%20deletion'},'Request account deletion ↗')));
    if(!sets.length)main.append(el('section',{class:'empty-library'},el('h2',{},'The first song is waiting.'),el('p',{},'Play a mood. We’ll remember the session here.'),el('a',{class:'bajaa-button primary',href:'/'},'Let it play ↗')));
    else main.append(el('div',{class:'saved-grid'},sets.map(set=>{
      const date=new Date(set.created_at),dt=Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(date):'Previous session';
      const replay=()=>{const songs=set.songs.filter(s=>!s.skipped && s.song_id).map(s=>s.song_id);if(!songs.length)return notice('There are no playable songs in this session. Try another mood.');try{localStorage.setItem('naux.replay',JSON.stringify({songs,answers:set.answers}));location.href='/';}catch{notice('Your browser could not prepare replay.');}};
      const remove=el('button',{class:'text-button',onclick:async()=>{
        if(remove.dataset.confirm){remove.disabled=true;let ok;if(account)ok=await account.remove(set.id);else{try{localStorage.setItem('naux.sets',JSON.stringify(read().filter(s=>s.id!==set.id)));ok=true;}catch{ok=false;}}if(ok)render();else{notice('This session could not be deleted. Try again.');remove.disabled=false;}return;}
        remove.dataset.confirm='yes';remove.textContent='Confirm deletion';const cancel=el('button',{class:'text-button',onclick:()=>{delete remove.dataset.confirm;remove.textContent='Delete session';cancel.remove();}},'Keep session');remove.after(cancel);cancel.focus();
      }},'Delete session');
      return el('article',{class:'saved-set'},el('div',{class:'history-row'},el('div',{},el('h2',{},set.name || 'A good night'),el('p',{},dt+' · '+set.songs.length+' songs')),el('button',{class:'bajaa-button secondary',onclick:replay},'Play again ↗')),
        el('details',{},el('summary',{},'What played'),el('ol',{class:'history-tracks'},set.songs.map(song=>el('li',{},el('span',{},song.title || 'Song'),el('small',{},song.artist || '')))),el('div',{class:'set-actions'},remove)));
    })));
    main.append(footer());app.replaceChildren(main);
  }
  window.BAJAADesign.requireSignIn().then(ok=>{if(ok)render();});window.addEventListener('bajaa:account',()=>{if(!window.BAJAAAccount?.user){version++;removeSyncListener();window.BAJAADesign.requireSignIn();}else render();});
})();

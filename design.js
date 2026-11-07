/* BAJAA's shared shell. Public configuration is injected by the build. */
(() => {
  'use strict';
  const el = (tag, attrs = {}, ...children) => {
    const n=document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{if(v==null || v===false)return;if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(k==='class')n.className=v;else n.setAttribute(k,v===true?'':v);});
    children.flat(9).forEach(c=>{if(c!=null)n.append(c instanceof Node?c:String(c));});return n;
  };
  function nav(active) {
    const account=el('a',{href:'/sets/',class:'account-link'},'Sign in');
    const update=()=>{account.textContent=window.BAJAAAccount?.user?'Your history':'Sign in';};
    window.addEventListener('bajaa:account',update); update();
    return el('header',{class:'site-header'},el('a',{class:'brand',href:'/',translate:'no','aria-label':'BAJAA home'},'BAJAA'),
      el('nav',{'aria-label':'Main navigation'},[['home','/','Listen'],['sets','/sets/','History']].map(([id,href,label])=>el('a',{href,'aria-current':active===id?'page':null},label))),account);
  }
  function footer() {
    return el('footer',{class:'site-footer'},el('div',{},el('a',{class:'footer-brand',href:'/'},'BAJAA'),el('p',{},'बस बजने दो · Just let it play.')),
      el('div',{class:'footer-links'},el('a',{href:'/privacy/'},'Privacy'),el('a',{href:'/terms/'},'Terms')),
      el('div',{class:'footer-note'},el('p',{},'Made by '+(window.BAJAA_CONFIG?.creatorName || 'SHIVANSH')+'.'),
        el('p',{class:'creator-links'},el('a',{href:'https://www.instagram.com/whyshivanshbansal/',target:'_blank',rel:'noopener noreferrer'},'Instagram'),el('a',{href:'https://www.linkedin.com/in/whyshivanshbansal/',target:'_blank',rel:'noopener noreferrer'},'LinkedIn'),el('a',{href:'https://github.com/TattvaAI',target:'_blank',rel:'noopener noreferrer'},'GitHub')),
        el('p',{},'Music through YouTube.')));
  }
  function notice(message) {
    document.querySelector('.bajaa-notice')?.remove();
    const note=el('div',{class:'bajaa-notice',role:'status'},el('span',{},message),el('button',{'aria-label':'Dismiss notice',onclick:()=>note.remove()},'×'));document.body.append(note);
  }
  async function requireSignIn(returnTo=location.pathname+location.search,openRoom=false) {
    const app=document.getElementById('app');
    if(!window.BAJAAAccount)await new Promise(resolve=>window.addEventListener('bajaa:account-ready',resolve,{once:true}));
    const account=window.BAJAAAccount;
    if(await(openRoom && account.openRoom?account.openRoom():account.authorize()))return true;
    const button=el('button',{class:'bajaa-button primary',onclick:async()=>{button.disabled=true;button.textContent='Opening Google…';await account.signIn(returnTo);button.disabled=false;button.textContent='Continue with Google ↗';}},'Continue with Google ↗');
    app.replaceChildren(el('main',{class:'signin-page'},el('header',{class:'site-header'},el('a',{class:'brand',href:'/'},'BAJAA')),el('section',{},el('p',{class:'eyebrow'},'The room starts here'),el('h1',{},'Sign in.',el('br'),'Then switch off.'),el('p',{},'One account. Your music and your history.'),button,el('p',{class:'signin-terms'},'By continuing, you agree to the ',el('a',{href:'/terms/'},'Terms'),' and ',el('a',{href:'/privacy/'},'Privacy policy'),'.'),el('div',{class:'maker-note'},el('span',{class:'maker-mark','aria-hidden':'true'},'बस बजने दो'),el('p',{},'Built for the friend who always gets handed the aux.'))),footer()));
    return false;
  }
  if(new URLSearchParams(location.search).has('auth_error'))notice('Google sign-in could not finish. Please try again.');
  window.BAJAADesign={el,nav,footer,notice,requireSignIn};
  window.addEventListener('bajaa:account-error',e=>notice(e.detail?.message || e.detail || 'Account connection failed.'));
  document.body.prepend(el('a',{class:'skip-link',href:'#main-content'},'Skip to content'));
  const enhance=()=>{const m=document.querySelector('main');if(m){m.id='main-content';m.tabIndex=-1;}};enhance();
  const host=document.querySelector('#app');if(host)new MutationObserver(enhance).observe(host,{childList:true});
  document.documentElement.style.colorScheme='light';
  if(location.pathname.startsWith('/songs')) {
    const main=document.querySelector('main');if(!main)return;
    main.firstElementChild?.matches('a') && main.firstElementChild.remove();main.prepend(nav('songs'));main.classList.add('catalog-page');
    if(location.pathname.replace(/\/$/,'')==='/songs') {
      main.classList.add('catalog-index');
    } else {
      main.classList.add('song-list-page');const list=main.querySelector('ol');
      if(list){list.classList.add('catalog-tracks');const details=el('details',{class:'catalog-details'},el('summary',{},'See the songs in this mood'),list);main.querySelector('a[href^="/?"]')?.after(details);}
    }
    document.body.append(footer());
  }
  if(['/privacy','/terms'].includes(location.pathname.replace(/\/$/,''))) {
    const main=document.querySelector('main');if(!main)return;main.prepend(nav());main.classList.add('legal-page');
    const contact=window.BAJAA_CONFIG?.contactEmail;if(contact)main.append(el('p',{},'Questions or account deletion: ',el('a',{href:'mailto:'+contact},contact)));
    document.body.append(footer());
  }
})();

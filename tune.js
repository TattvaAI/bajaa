/* Local cut suggestions. Backend aggregation can consume naux.tuneSuggestions later. */
(async () => {
  'use strict';
  const {el,nav,footer,notice}=window.BAJAADesign;
  const app=document.getElementById('app');
  if(!await window.BAJAADesign.requireSignIn())return;
  window.BAJAA_LIBRARY=await window.BAJAAAccount.library();
  const read=(key,fallback)=> {try{const value=JSON.parse(localStorage.getItem(key) || 'null');return value ?? fallback;}catch{return fallback;}};
  const tuned=read('naux.tuned',[]);const previous=read('naux.tuneSuggestions',[]);
  const excluded=new Set(Array.isArray(tuned)?tuned:[]);
  const queue=(window.BAJAA_LIBRARY || []).filter(s=>s.unsure && !s.play_full && s.youtube_ids?.length && s.duration_sec>30 && s.entry_sec>=0 && s.entry_sec<s.duration_sec && (s.exit_sec==null || (s.exit_sec>s.entry_sec && s.exit_sec<=s.duration_sec)) && !excluded.has(s.song_id)).sort((a,b)=>(b.fame ?? 2)-(a.fame ?? 2));
  let index=0,phase='intro',player=null,ready=false,error='',elapsed=0,lastTime=null,timer=null,startAt=0,endAt=0,votes=Array.isArray(previous)?previous.length:0,playing=false,apiPending=false;
  const current=()=>queue[index];
  const fmt=s=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
  const widget=el('div',{class:'tune-video',style:'aspect-ratio:16/9;width:100%;max-width:420px;flex-shrink:0;border-radius:12px;overflow:hidden;background:#101210'});
  let confirmButton,listenStatus,positionLabel,range;
  function initialize(){const song=current();if(song){startAt=song.entry_sec;endAt=Math.min(song.exit_sec ?? song.duration_sec-1,song.duration_sec-1);}phase='intro';elapsed=0;lastTime=null;error='';}
  initialize();
  function render(){
    const song=current();
    const main=el('main',{class:'tune-page'},nav('tune'),el('h1',{class:'font-display'},'Find the best part.'),el('p',{class:'mt-3'},'Help shape the next set. Listen, pick the hook, then choose a good moment to move on. Suggestions are saved on this device.'));
    if(!song){main.append(el('div',{},el('h2',{class:'font-display'},'You’ve heard them all.'),el('p',{class:'mt-3'},'Your suggestions are saved on this device. Thank you for listening.'),el('a',{href:'/',class:'bajaa-button primary mt-6'},'Build a set')),footer());app.replaceChildren(main);return;}
    const info=el('div',{class:'min-w-0 flex-1'},el('p',{class:'tune-step'},phase==='start'?'1 of 2 · Choose the start':phase==='end'?'2 of 2 · Choose the ending':`${queue.length-index} songs to explore`),el('h2',{class:'font-display mt-3'},song.title),el('p',{class:'mt-3 text-white/65'},song.artist));
    if(error) info.append(el('p',{class:'tune-error',role:'alert'},error));
    const controls=el('div',{class:'tune-actions'});
    if(phase==='intro') controls.append(el('button',{class:'bajaa-button primary mt-6',onclick:()=>begin()},apiPending?'Connecting to YouTube…':'Start listening'));
    else{
      positionLabel=el('span',{},fmt(phase==='start'?startAt:endAt));
      range=el('input',{type:'range',min:phase==='start'?'0':String(startAt+1),max:phase==='start'?String(song.duration_sec-2):String(song.duration_sec-1),step:'1',value:String(phase==='start'?startAt:endAt),'aria-label':phase==='start'?'Choose song start time':'Choose song end time'});
      const move=offset=>{range.value=String(Math.min(Number(range.max),Math.max(Number(range.min),Number(range.value)+offset)));choose(Number(range.value));};
      range.addEventListener('input',()=>choose(Number(range.value)));
      controls.append(el('div',{class:'seek-controls'},el('label',{},phase==='start'?'Start at':'End at', ' ',positionLabel),range,el('button',{class:'bajaa-button secondary','aria-label':'Move chosen time back 5 seconds',onclick:()=>move(-5)},'−5 sec'),el('button',{class:'bajaa-button secondary','aria-label':'Move chosen time forward 5 seconds',onclick:()=>move(5)},'+5 sec')));
      listenStatus=el('p',{class:'listen-status',role:'status','aria-live':'polite'},'Listen for 6 seconds, then confirm the cut.');
      confirmButton=el('button',{class:'bajaa-button primary',disabled:'',onclick:()=>confirm()},phase==='start'?'Use this start':'Save these cuts');
      controls.append(listenStatus,el('div',{class:'tune-confirm-row'},confirmButton,el('button',{class:'bajaa-button secondary',onclick:()=>{if(!player)return;playing=!playing;playing?player.playVideo():player.pauseVideo();}},'Pause / play')));
    }
    controls.append(el('button',{class:'back-button mt-6',onclick:()=>next()},'Skip this song'));
    info.append(controls);
    main.append(el('div',{class:'mt-6 flex flex-col gap-6 md:flex-row md:items-start md:gap-10'},info,widget),el('p',{class:'sets-intro'},`${votes} suggestion${votes===1?'':'s'} saved on this device. Music plays through YouTube.`),footer());
    app.replaceChildren(main);
  }
  function loadApi(){
    if(window.YT?.Player)return Promise.resolve(window.YT);
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('YouTube did not connect. Check your connection or try again.')),15000);
      const prev=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);prev?.();resolve(window.YT);};
      const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>{clearTimeout(timeout);reject(Error('YouTube could not load. Check your connection or script blocker.'));};document.head.append(script);
    });
  }
  async function begin(){
    if(apiPending)return;
    error='';apiPending=true;render();
    try{
      const YT=await loadApi();
      if(!player){await new Promise((resolve,reject)=>{
        const host=el('div');widget.replaceChildren(host);const timeout=setTimeout(()=>reject(Error('The player did not become ready. Try again.')),15000);
        player=new YT.Player(host,{width:'100%',height:'100%',playerVars:{controls:1,playsinline:1,rel:0},events:{onReady:()=>{clearTimeout(timeout);ready=true;resolve();},onStateChange:e=>{playing=e.data===1;},onError:()=>{error='This upload is unavailable. Try the next song.';clearInterval(timer);render();}}});
      });}
      apiPending=false;phase='start';render();preview();
    }catch(e){apiPending=false;error=e.message;render();}
  }
  function choose(at){if(phase==='start')startAt=at;else endAt=at;positionLabel.textContent=fmt(at);preview();}
  function preview(){
    const song=current();if(!song || !ready)return;
    const at=phase==='end'?Math.max(startAt,endAt-6):startAt;
    player.loadVideoById({videoId:song.youtube_ids[0],startSeconds:at});player.playVideo();playing=true;elapsed=0;lastTime=null;clearInterval(timer);
    if(confirmButton){confirmButton.disabled=true;confirmButton.textContent=phase==='start'?'Use this start':'Save these cuts';}
    if(listenStatus)listenStatus.textContent='Listen for 6 seconds, then confirm the cut.';
    timer=setInterval(()=>{
      if(!player || !confirmButton)return;
      const t=player.getCurrentTime();if(player.getPlayerState()===1 && lastTime!==null && t>lastTime && t-lastTime<2)elapsed+=t-lastTime;lastTime=t;
      if(elapsed>=6){confirmButton.disabled=false;listenStatus.textContent='Ready to confirm. Adjust the time if you want to listen again.';clearInterval(timer);}
    },250);
  }
  function confirm(){
    if(elapsed<6)return;
    if(phase==='start'){phase='end';endAt=Math.max(startAt+1,Math.min(current().exit_sec ?? current().duration_sec-1,current().duration_sec-1));render();preview();return;}
    if(endAt<=startAt){error='Choose an ending after the start.';render();return;}
    const song=current();const suggestions=read('naux.tuneSuggestions',[]);const done=read('naux.tuned',[]);
    try{
      const all=Array.isArray(suggestions)?suggestions:[];all.push({song_id:song.song_id,start_sec:startAt,end_sec:endAt,created_at:new Date().toISOString()});
      localStorage.setItem('naux.tuneSuggestions',JSON.stringify(all));localStorage.setItem('naux.tuned',JSON.stringify([...(Array.isArray(done)?done:[]),song.song_id]));localStorage.setItem('naux.tuneVotes',String(++votes));notice('Start and end suggestion saved on this device.');next();
    }catch{notice('Could not save your suggestion. Check site storage permissions.');}
  }
  function next(){clearInterval(timer);player?.stopVideo();index++;initialize();render();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)player?.pauseVideo();});
  window.addEventListener('pagehide',()=>{clearInterval(timer);player?.destroy();},{once:true});
  render();
})();

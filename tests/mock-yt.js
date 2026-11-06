window.__players=[];
window.YT={Player:class{
 constructor(node,options){this.node=typeof node==='string'?document.getElementById(node):node;this.options=options;this.t=0;this.duration=240;this.state=2;this.volume=100;this.muted=false;this.iframe=document.createElement('iframe');this.iframe.title='Test music player';this.node.replaceWith(this.iframe);window.__players.push(this);setTimeout(()=>options.events.onReady?.({target:this}),5);}
 getIframe(){return this.iframe;}getCurrentTime(){return this.t;}getDuration(){return this.duration;}getPlayerState(){return this.state;}getVolume(){return this.volume;}setVolume(v){this.volume=v;}isMuted(){return this.muted;}mute(){this.muted=true;}unMute(){this.muted=false;}
 loadVideoById(spec){this.spec=spec;this.t=spec.startSeconds || 0;this.state=1;setTimeout(()=>this.options.events.onStateChange?.({data:1,target:this}),5);}
 cueVideoById(spec){this.spec=spec;this.t=spec.startSeconds || 0;this.state=5;}
 playVideo(){this.state=1;setTimeout(()=>this.options.events.onStateChange?.({data:1,target:this}),5);}
 pauseVideo(){this.state=2;}stopVideo(){this.state=0;}seekTo(t){this.t=t;}destroy(){this.state=0;this.iframe.remove();this.destroyed=true;}
}};

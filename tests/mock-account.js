/* Test-only verified identity and history store. Not included in production output. */
window.BAJAAAccount={ready:Promise.resolve(),configured:true,verified:true,user:{id:'test-user',name:'Listener'},authorize:async()=>true,
 async library(){return window.__testLibrary;},
 async list(){return JSON.parse(localStorage.getItem('naux.sets') || '[]');},
 async save(item){const rows=await this.list();localStorage.setItem('naux.sets',JSON.stringify([item,...rows.filter(x=>x.id!==item.id)]));return true;},
 async remove(id){localStorage.setItem('naux.sets',JSON.stringify((await this.list()).filter(x=>x.id!==id)));return true;},
 async signOut(){this.user=null;this.verified=false;this.authorize=async()=>false;window.dispatchEvent(new Event('bajaa:account'));},async signIn(){}
};

import { authenticate, database, withinRequestLimit } from '../server/history.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');
 if(req.method!=='DELETE'){res.statusCode=405;res.setHeader('Allow','DELETE');return res.end('{}');}
 const user=await authenticate(req);if(!user){res.statusCode=401;return res.end('{}');}
 if(req.body?.confirm!==true){res.statusCode=400;return res.end(JSON.stringify({error:'Confirm history deletion.'}));}
 try{if(!await withinRequestLimit(user)){res.statusCode=429;return res.end(JSON.stringify({error:'Please wait a minute and try again.'}));}await database().query('DELETE FROM bajaa_history WHERE user_id=$1',[user]);res.end(JSON.stringify({deleted:true}));}
 catch{res.statusCode=503;res.end(JSON.stringify({error:'History could not be deleted. Please try again.'}));}
}

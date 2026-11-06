import { authenticate } from '../server/history.mjs';
export default async function handler(req,res){res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');const user=await authenticate(req);res.statusCode=user?200:401;res.end(JSON.stringify(user?{id:user}:{error:'Sign in to listen.'}));}

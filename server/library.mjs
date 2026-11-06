import fs from 'node:fs';
import vm from 'node:vm';
import { authenticate } from './history.mjs';
let library;
export function musicLibrary(){if(!library){const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../seed.js',import.meta.url),'utf8'),context);library=context.window.BAJAA_LIBRARY;}return library;}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');
 if(req.method!=='GET'){res.statusCode=405;res.end(JSON.stringify({error:'Method not allowed'}));return;}
 if(!await authenticate(req)){res.statusCode=401;res.end(JSON.stringify({error:'Sign in to listen.'}));return;}
 res.end(JSON.stringify(musicLibrary()));
}

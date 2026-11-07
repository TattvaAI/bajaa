import { handleAuthProxyRequest } from '@neon/auth/server';

// Keep Neon sessions on BAJAA's own origin, including Safari's cookie jar.
const routes = new Map([
  ['get-session', ['GET']],
  ['token', ['GET']],
  ['sign-in/social', ['POST']],
  ['sign-out', ['POST']],
  ['callback/google', ['GET']],
]);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const url = new URL(req.url, `${proto}://${req.headers.host}`);
  const path = url.searchParams.get('path') || url.pathname.replace(/^\/api\/auth\//, '');
  url.searchParams.delete('path');
  if (!routes.has(path)) {
    res.statusCode = 404;
    return res.end('{}');
  }
  if (!routes.get(path).includes(req.method)) {
    res.statusCode = 405;
    res.setHeader('Allow', routes.get(path).join(', '));
    return res.end('{}');
  }
  if (req.method === 'POST' && req.headers.origin !== (process.env.BAJAA_AUTH_MODE==='direct'?(process.env.BETTER_AUTH_URL || 'https://bajaa.vercel.app'):url.origin)) {
    res.statusCode = 403;
    return res.end('{}');
  }
  if(process.env.BAJAA_AUTH_MODE==='direct'){
    if(path==='token'){res.statusCode=404;return res.end('{}');}
    const {directAuth}=await import('../server/direct-auth.mjs');
    const origin=process.env.BETTER_AUTH_URL || 'https://bajaa.vercel.app';
    const target=new URL('/api/auth/'+path+url.search,origin);
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
    headers.set('host',target.host);
    const body=req.body===undefined?undefined:typeof req.body==='string'?req.body:JSON.stringify(req.body);
    try{const response=await directAuth().handler(new Request(target,{method:req.method,headers,...(body?{body}:{})}));res.statusCode=response.status;for(const [key,value]of response.headers)if(key!=='set-cookie')res.setHeader(key,value);const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);return res.end(Buffer.from(await response.arrayBuffer()));}
    catch{res.statusCode=503;return res.end(JSON.stringify({message:'Sign-in is temporarily unavailable.'}));}
  }
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.NEON_AUTH_COOKIE_SECRET) {
    res.statusCode = 503;
    return res.end(JSON.stringify({message:'Sign-in is temporarily unavailable.'}));
  }
  // A new visitor cannot have a session without an auth cookie or OAuth verifier.
  // Avoid an upstream database round trip merely to rediscover that fact.
  if (path === 'get-session' && !url.search && !(req.headers.cookie || '').includes('__Secure-neon-auth.')) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({session:null,user:null}));
  }
  const started = performance.now();
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const body = req.body === undefined ? undefined : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const request = new Request(url, {method:req.method, headers, ...(body ? {body, duplex:'half'} : {})});
  try {
    const response = await handleAuthProxyRequest({
      request, path,
      baseUrl:process.env.NEON_AUTH_BASE_URL,
      cookieSecret:process.env.NEON_AUTH_COOKIE_SECRET,
      sessionDataTtl:300,
      sameSite:'lax',
    });
    res.setHeader('Server-Timing', `auth;dur=${Math.round(performance.now()-started)}`);
    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
      if (key !== 'set-cookie' && key !== 'content-encoding') res.setHeader(key, value);
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({message:'The sign-in service could not be reached. Please try again.'}));
  }
}

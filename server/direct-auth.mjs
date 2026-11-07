import { betterAuth } from 'better-auth';
import { database } from './history.mjs';
import { validGoogleSecret } from './auth-config.mjs';

let instance;
export function directAuth(){
 if(!instance){
  if(!process.env.BETTER_AUTH_SECRET || !process.env.GOOGLE_CLIENT_ID || !validGoogleSecret(process.env.GOOGLE_CLIENT_SECRET))throw Error('BAJAA auth configuration missing or invalid');
  instance=betterAuth({
   appName:'BAJAA',
   baseURL:process.env.BETTER_AUTH_URL || 'https://bajaa.vercel.app',
   onAPIError:{errorURL:'https://bajaa.vercel.app/?auth_error=1'},
   basePath:'/api/auth',secret:process.env.BETTER_AUTH_SECRET,
   trustedOrigins:[process.env.BETTER_AUTH_URL || 'https://bajaa.vercel.app'],
   database:database(),
   user:{modelName:'bajaa_auth_user'},
   databaseHooks:{session:{create:{before:async session=>{const {rows}=await database().query('SELECT banned FROM bajaa_auth_user WHERE id=$1',[session.userId]);return rows[0]?.banned?false:undefined;}}}},
   session:{modelName:'bajaa_auth_session',cookieCache:{enabled:true,maxAge:300}},
   account:{modelName:'bajaa_auth_account',accountLinking:{enabled:false}},
   verification:{modelName:'bajaa_auth_verification'},
   socialProviders:{google:{clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET}},
   advanced:{cookiePrefix:'bajaa',ipAddress:{ipAddressHeaders:['x-vercel-forwarded-for']},database:{generateId:()=>crypto.randomUUID()}},
   rateLimit:{enabled:true,storage:'database',modelName:'bajaa_auth_rate_limit',window:60,max:100,customRules:{'/sign-in/social':{window:60,max:10}}},
  });
 }
 return instance;
}

export async function directIdentity(req){
 const headers=new Headers();
 if(req.headers.cookie)headers.set('cookie',req.headers.cookie);
 const session=await directAuth().api.getSession({headers,query:{disableCookieCache:true}});
 if(!session?.user || !session.session || new Date(session.session.expiresAt).getTime()<=Date.now())return null;
 const {rows}=await database().query('SELECT id FROM bajaa_auth_user WHERE id=$1 AND banned=false',[session.user.id]);
 return rows.length?session.user.id:null;
}

export function validGoogleSecret(value){
 return typeof value==='string' && /^GOCSPX-[A-Za-z0-9_-]{20,}$/.test(value);
}

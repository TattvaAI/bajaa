const assert=require('node:assert/strict');
(async()=>{
 const {validGoogleSecret}=await import('../server/auth-config.mjs');
 for(const value of [undefined,'',' ','********','redacted','hidden','GOCSPX-short'])assert.equal(validGoogleSecret(value),false);
 assert.equal(validGoogleSecret('GOCSPX-'+'test'.repeat(8)),true);
 console.log('PASS Google auth configuration rejects masked and invalid secrets');
})();

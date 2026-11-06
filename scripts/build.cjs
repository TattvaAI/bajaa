require('./env.cjs');
const fs=require('node:fs');const path=require('node:path');const root=path.join(__dirname,'..');
require('./build-song-pages.cjs');
const dist=path.join(root,'dist');fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist);
for(const name of ['index.html','404.html','app.js','design.js','design.css','styles.css','sets.js','tune.js','favicon.svg','fonts','songs','sets','tune','privacy','terms']) {
 const source=path.join(root,name);if(fs.existsSync(source))fs.cpSync(source,path.join(dist,name),{recursive:true});
}
const config={authUrl:process.env.NEON_AUTH_BASE_URL ? '/api/auth' : '',creatorName:process.env.PUBLIC_CREATOR_NAME || 'SHIVANSH',contactEmail:process.env.PUBLIC_CONTACT_EMAIL || 'contact@interncell.com'};
const js='window.BAJAA_CONFIG='+JSON.stringify(config).replace(/</g,'\\u003c')+';';fs.writeFileSync(path.join(dist,'config.js'),js);fs.writeFileSync(path.join(root,'config.js'),js);
(async()=>{await require('esbuild').build({entryPoints:[path.join(root,'account.js')],bundle:true,minify:true,format:'iife',platform:'browser',target:'es2022',outfile:path.join(dist,'account.bundle.js')});fs.copyFileSync(path.join(dist,'account.bundle.js'),path.join(root,'account.bundle.js'));console.log('BAJAA production build complete. Public files in dist/.');})();

const fs=require('node:fs');const path=require('node:path');const {parseEnv}=require('node:util');
for(const name of ['.env.local','.env']){const file=path.join(__dirname,'..',name);if(fs.existsSync(file)){for(const [key,value]of Object.entries(parseEnv(fs.readFileSync(file,'utf8'))))if(process.env[key]===undefined)process.env[key]=value;}}

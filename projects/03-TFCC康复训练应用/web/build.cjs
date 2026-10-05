const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const assets={};
for(const [name,type] of Object.entries({'index.html':'text/html; charset=utf-8','base.css':'text/css; charset=utf-8','mobile.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8'})) assets[name]={type,body:fs.readFileSync(path.join(root,'dist',name),'utf8')};
const media=[...new Set(assets['index.html'].body.match(/[A-Za-z0-9][A-Za-z0-9-]*\.(?:mp4|png)/g))];
fs.mkdirSync(path.join(root,'dist','server'),{recursive:true});
fs.writeFileSync(path.join(root,'dist','server','index.js'),'const STATIC_ASSETS='+JSON.stringify(assets)+';\nconst MEDIA_NAMES='+JSON.stringify(media)+';\n'+fs.readFileSync(path.join(root,'worker.mjs'),'utf8'));
console.log('Worker built: 4 page assets; '+media.length+' media objects.');

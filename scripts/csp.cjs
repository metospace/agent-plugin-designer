const {readFileSync,writeFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const html=readFileSync('dist/index.html','utf8');
const hashes=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>"'sha256-"+createHash('sha256').update(m[1]).digest('base64')+"'");
const policy=`default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
writeFileSync('dist/index.html',html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`));

const {readFileSync,writeFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const web=process.argv.includes('--web');
const output=web?'dist-web/index.html':'dist/index.html';
const html=readFileSync(output,'utf8');
const hashes=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>"'sha256-"+createHash('sha256').update(m[1]).digest('base64')+"'");
const policy=`default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src ${web ? "https: http://localhost:* http://127.0.0.1:* http://[::1]:*" : "'none'"}; object-src 'none'; base-uri 'none'; form-action 'none'`;
writeFileSync(output,html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${policy}">`));

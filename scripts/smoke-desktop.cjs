const {spawn,spawnSync}=require('node:child_process');
const {mkdtempSync,readFileSync,mkdirSync,writeFileSync,existsSync}=require('node:fs');
const {join,resolve}=require('node:path');const {tmpdir}=require('node:os');
const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');
const {dragRegression}=require('./drag-regression.cjs');
if(process.platform!=='win32')throw Error('Run packaged app verification on Windows');
const root=mkdtempSync(join(tmpdir(),'agent-studio-mygo-')),out=resolve('deliverables/windows');mkdirSync(out,{recursive:true});
const exe=resolve(process.argv[2]||'build/windows-amd64/Agent Studio.exe');
let active;const messages=[];
async function preview(page,label){const c=await page.context().newCDPSession(page);const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));const shot=await c.send('Page.captureScreenshot',{format:'jpeg',quality:65,clip:{x:0,y:0,...size,scale:.6}});console.log('WINDOWS_'+label+'_BASE64_BEGIN');console.log(shot.data);console.log('WINDOWS_'+label+'_BASE64_END');await c.detach();}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<200;i++){try{const v=await fn();if(v)return v;}catch{}await sleep(100);}throw Error('Timed out waiting for Windows app or export');}
async function dialog(page,action,path,name,cancel=false){
 const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('scripts/native-dialog.ps1'),'-Title',name,'-Screenshot',join(out,cancel?'save-cancel.png':path.endsWith('.json')?'project-dialog.png':'plugin-dialog.png')];
 if(cancel)args.push('-Cancel');else args.push('-Path',path);
 const child=spawn('powershell',args);let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 const done=new Promise((res,rej)=>child.on('exit',code=>code===0?res():rej(Error(log))));
 await action();await sleep(300);console.log('DIALOG_ACTION_STATUS',await page.locator('.toast').allTextContents());await done;return log;
}
async function open(){
 const net=require('node:net');const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const app=spawn(exe,[],{env:{...process.env,AGENT_STUDIO_DEBUG:'1',APPDATA:join(root,'roaming'),LOCALAPPDATA:join(root,'local'),WEBVIEW2_USER_DATA_FOLDER:join(root,'webview'),WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`},stdio:'pipe'});
 let log='';app.stderr.on('data',b=>log+=b);app.on('error',e=>log+=e.message);
 const browser=await until(async()=>{if(app.exitCode!==null)throw Error('App exited '+log);return chromium.connectOverCDP(`http://127.0.0.1:${port}`)});
 const page=await until(()=>browser.contexts()[0]?.pages().find(p=>p.url().startsWith('http://mygo.localhost')));
 page.on('console',m=>messages.push(m.type()+': '+m.text()));active={page,log:()=>log};
 await page.getByText('已保存到本机',{exact:true}).waitFor();
 return {app,browser,page,async close(){spawnSync('powershell',['-NoProfile','-Command',`(Get-Process -Id ${app.pid}).CloseMainWindow()`]);await until(()=>app.exitCode!==null);await browser.close();await sleep(500)}};
}
(async()=>{
 let s=await open();const p=s.page;const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const bridge=await p.evaluate(()=>({mygo:typeof window.mygo,call:typeof window.mygo?.call,transport:typeof window.chrome?.webview,origin:location.origin}));console.log('BRIDGE_STATUS',JSON.stringify(bridge));assert.equal(bridge.call,'function','MyGo bridge missing on initial app load');
 assert.equal(new URL(p.url()).origin,'http://mygo.localhost');assert.equal(await p.evaluate(()=>typeof window.require),'undefined');
 const drag=await dragRegression(p,out,'windows-drag',preview);assert.ok(drag.frames>100);for(const key of ['blankFrames','replacedFrames','viewportChanges','edgeMissingFrames'])assert.equal(drag[key],0,key);
 await preview(p,'DRAG');
 const first=join(root,'project.json');
 await dialog(p,()=>p.getByRole('button',{name:'保存项目文件',exact:true}).click(),first,'保存 Agent Studio 导出文件');
 const original=await until(()=>JSON.parse(readFileSync(first,'utf8')));
 for(const n of original.nodes)assert.deepEqual(Object.keys(n).sort(),['data','id','position','type']);
 await dialog(p,()=>p.getByRole('button',{name:'保存项目文件',exact:true}).click(),'','保存 Agent Studio 导出文件',true);
 await p.getByRole('button',{name:'导出插件',exact:false}).first().click();
 const md=join(root,'PLUGIN.md');await dialog(p,()=>p.getByRole('button',{name:/Markdown 插件/}).click(),md,'保存 Agent Studio 导出文件');await until(()=>existsSync(md));assert.ok(readFileSync(md,'utf8').includes('宿主必须自行适配'));
 const zipPath=join(root,'plugin.zip');await p.getByRole('button',{name:'导出插件',exact:false}).first().click();
 await dialog(p,()=>p.getByRole('button',{name:/完整插件 ZIP/}).click(),zipPath,'保存 Agent Studio 导出文件');
 const zip=await until(async()=>require('jszip').loadAsync(readFileSync(zipPath)));assert.ok((await zip.file('PLUGIN.md').async('string')).includes('宿主必须自行适配'));
 // UI edits and real file picker import, then a complete process restart.
 const imported={...original,name:'MyGo restart and import verified',nodes:original.nodes.map((n,i)=>i? n:{...n,position:{x:n.position.x+17,y:n.position.y+9}})};
 const input=join(root,'import.json');writeFileSync(input,JSON.stringify(imported));
 await dialog(p,()=>p.getByRole('button',{name:'导入项目',exact:true}).click(),input,'Open');
 await p.getByRole('status').filter({hasText:'已导入为独立项目'}).waitFor();await sleep(700);
 const expected=await p.evaluate(async()=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('agent-plugin-designer',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});const tx=db.transaction('workspace');const value=await new Promise(res=>{const r=tx.objectStore('workspace').get('current');r.onsuccess=()=>res(r.result)});db.close();return value});
 assert.equal(expected.projects.length,2);await s.close();s=await open();
 await s.page.locator('.project-title').filter({hasText:imported.name}).waitFor();
 const after=join(root,'after.json');await dialog(s.page,()=>s.page.getByRole('button',{name:'保存项目文件',exact:true}).click(),after,'保存 Agent Studio 导出文件');await until(()=>existsSync(after));const actual=JSON.parse(readFileSync(after,'utf8'));assert.deepEqual(actual.nodes,imported.nodes);assert.deepEqual(actual.edges,imported.edges);assert.equal(actual.name,imported.name);assert.deepEqual(actual,{...imported,id:actual.id});
 const retained=await s.page.evaluate(async()=>{const db=await new Promise(res=>{const r=indexedDB.open('agent-plugin-designer',1);r.onsuccess=()=>res(r.result)});const value=await new Promise(res=>{const r=db.transaction('workspace').objectStore('workspace').get('current');r.onsuccess=()=>res(r.result)});db.close();return value});assert.deepEqual(retained,expected);
 await s.page.screenshot({path:join(out,'windows-restarted.png')});await preview(s.page,'RESTART');await s.close();assert.deepEqual(errors,[]);
 const result={runtime:'MyGo / installed OS WebView2',origin:'http://mygo.localhost',releaseExe:exe,drag,nativeSave:true,nativeCancel:true,nativeImport:true,markdown:true,binaryZip:true,processRestart:true,canonicalLayoutAndEdgesPersist:true,projectsRetained:2,errors};
 writeFileSync(join(out,'desktop-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 // Full resolution evidence remains in the verification artifact.
 console.log('Windows verification complete');
})().catch(async e=>{console.error(e);console.error('PAGE CONSOLE',messages);console.error('APP STDERR',active?.log());if(active)await preview(active.page,'FAILURE').catch(()=>{});process.exit(1)});

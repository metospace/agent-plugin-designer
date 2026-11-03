import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runTask} from './runner.mjs';
export function codexHost(command=process.env.APD_CODEX_BIN||'codex',options={}){
 for(const key of Object.keys(options))if(!['model','ignoreUserConfig','ephemeral'].includes(key))throw Error('Unsupported Codex host option: '+key);
 if(options.model!==undefined&&(typeof options.model!=='string'||!options.model.trim()))throw Error('Explicit model must be a nonempty string');
 for(const key of ['ignoreUserConfig','ephemeral'])if(options[key]!==undefined&&typeof options[key]!=='boolean')throw Error(key+' must be boolean');
 const optionArgs=[...(options.ignoreUserConfig?['--ignore-user-config']:[]),...(options.ephemeral?['--ephemeral']:[]),...(options.model?['--model',options.model]:[])];
 return {
 async check(){if(process.platform==='win32'&&!command.toLowerCase().endsWith('.exe'))throw Error('Windows requires user-owned APD_CODEX_BIN pointing to native codex.exe; npm cmd/bat shims are unsupported without a shell');if(!['read-only','workspace-write'].includes(process.env.APD_CODEX_DEVELOPER_SANDBOX))throw Error('Set APD_CODEX_DEVELOPER_SANDBOX=read-only or workspace-write in the user-owned launcher before starting the main host. Child CLI cannot infer parent runtime permissions.');const r=spawnSync(command,['--version'],{encoding:'utf8',shell:false,timeout:10000,killSignal:'SIGKILL'});if(r.status!==0||!/^codex-cli 0\.159\.0-alpha\.3\s*$/.test(r.stdout))throw Error('Requires Codex 0.159.0-alpha.3; run installation capability check');if(optionArgs.length){const help=spawnSync(command,['exec','--help'],{encoding:'utf8',shell:false,timeout:10000,killSignal:'SIGKILL'});if(help.status!==0)throw Error('Cannot verify explicit Codex option capabilities');for(const flag of optionArgs.filter(x=>x.startsWith('--')))if(!help.stdout.includes(flag))throw Error('Installed Codex does not advertise requested option '+flag);}},
 async start({role,permission,prompt,schema,workspace,signal}){
  signal?.throwIfAborted();
  const temp=mkdtempSync(join(tmpdir(),'apd-codex-')),schemaPath=join(temp,'schema.json'),output=join(temp,'result.json');writeFileSync(schemaPath,JSON.stringify(schema));
  // User-owned launcher opts in developer policy. Model/task JSON cannot grant it; QA stays read-only.
  const policy=role==='qa'||permission==='read-only'?'read-only':process.env.APD_CODEX_DEVELOPER_SANDBOX;
  if(permission==='workspace-write'&&policy!=='workspace-write')throw Error('Configured write node requires user launcher workspace-write opt-in');
  if(!['read-only','workspace-write'].includes(policy))throw Error('Developer sandbox launcher opt-in missing');
  const child=spawn(command,['exec',...optionArgs,'--json','--sandbox',policy,'--cd',workspace,'--output-schema',schemaPath,'--output-last-message',output,prompt],{stdio:['ignore','pipe','pipe'],shell:false,detached:process.platform!=='win32'});
  // A fresh Unix session/group contains ordinary tool descendants; never signal our own group.
  let terminated=false,terminationError;
  const terminate=()=>{if(terminated)return terminationError;terminated=true;try{if(process.platform!=='win32'&&Number.isInteger(child.pid)&&child.pid>1&&child.pid!==process.pid)process.kill(-child.pid,'SIGKILL');else if(child.exitCode===null)child.kill('SIGKILL');}catch(e){if(e.code!=='ESRCH')terminationError=e;}return terminationError;};
  const abort=()=>{const error=terminate();rejectId?.(error??Error('Codex dispatch aborted'));};process.once('SIGINT',abort);process.once('SIGTERM',abort);
  let id,buffer='',stderr='',completed=false,resolveId,rejectId;
  const identity=new Promise((resolve,reject)=>{resolveId=resolve;rejectId=reject;});
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-4096);});
  child.stdout.on('data',b=>{buffer+=b.toString();for(;;){const i=buffer.indexOf('\n');if(i<0)break;const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{const e=JSON.parse(line);if(e.type==='thread.started'&&typeof e.thread_id==='string'){id=e.thread_id;resolveId(id);}if(e.type==='turn.completed')completed=true;}catch{ /* only complete valid JSONL events count */ }}});
  const result=new Promise((resolve,reject)=>{child.once('error',e=>{rejectId(e);reject(e);});child.once('close',code=>{if(!id)rejectId(Error('Missing real Codex thread.started'));if(code!==0||!completed)return reject(Error('Codex execution interrupted or failed: '+stderr));try{resolve({stopReason:'completed',structured:JSON.parse(readFileSync(output,'utf8'))});}catch(e){reject(e);}});});
  // Mark rejection observed even if process fails before publishing an identity.
  result.catch(()=>{});
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const removeListeners=()=>{signal?.removeEventListener('abort',abort);process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);};
  try{await identity;}catch(e){removeListeners();terminate();rmSync(temp,{recursive:true,force:true});throw e;}
  return {id,result,policy,async dispose(){removeListeners();const error=terminate();rmSync(temp,{recursive:true,force:true});if(error)throw error;}};
 }
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{const bundle=JSON.parse(readFileSync(process.argv[2],'utf8')),input=JSON.parse(readFileSync(process.argv[3],'utf8'));const s=await runTask(bundle,input,codexHost());process.stdout.write(JSON.stringify(s)+'\n');if(s.status==='blocked')process.exitCode=2;}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
}

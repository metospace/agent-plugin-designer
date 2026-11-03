/** Installs the actual UI-produced native packages in isolated real host profiles. No model calls. */
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import JSZip from 'jszip';
import {digest} from '../runtime/workflow.mjs';
const root=mkdtempSync(join(tmpdir(),'apd-general-install-')),codex=process.env.APD_CODEX_BIN??'codex',dsh=process.env.APD_DSH_BIN??'/tmp/harness-host-test/node_modules/.bin/dsh',evidence={classification:'ACTUAL HOST INSTALLATION/DISCOVERY/REMOVAL OF UI EXPORTED PACKAGES; NO MODEL CALLS',root,externalLlmCalls:0,operations:[],packages:[]};
function run(command,args,env){const r=spawnSync(command,args,{env:{...process.env,...env},encoding:'utf8',shell:false});evidence.operations.push({command,args,status:r.status,stdout:r.stdout,stderr:r.stderr});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout;}
try{
for(const target of ['codex','deepseek']){
 const env=target==='codex'?{CODEX_HOME:join(root,'codex-home')}:{DSH_HOME:join(root,'dsh-home'),XDG_DATA_HOME:join(root,'data'),XDG_CACHE_HOME:join(root,'cache')};mkdirSync(Object.values(env)[0],{recursive:true});const command=target==='codex'?codex:dsh;run(command,['--version'],env);const packages=[];
 for(const name of ['sequence','branch-loop-human','parallel']){const file=resolve('deliverables/general-ui/'+name+'-'+target+'.zip'),zip=await JSZip.loadAsync(readFileSync(file)),dir=join(root,target,name);for(const [name,entry]of Object.entries(zip.files)){if(entry.dir)continue;const path=join(dir,name);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,await entry.async('nodebuffer'));}const manifest=JSON.parse(readFileSync(join(dir,target==='codex'?'.codex-plugin/plugin.json':'package.json'))),id=manifest.name;packages.push(id);evidence.packages.push({target,name,id,zipSha256:digest(readFileSync(file))});if(target==='codex'){run(command,['plugin','marketplace','add',dir,'--json'],env);run(command,['plugin','add',id+'@'+id+'-market','--json'],env);}else run(command,['plugin','--profile','apd-general-test','add',dir],env);}
 if(target==='codex'){const listing=JSON.parse(run(command,['plugin','list','--json'],env));for(const id of packages)if(!listing.installed.some(p=>p.enabled&&(p.id===id+'@'+id+'-market'||p.name===id||JSON.stringify(p).includes(id))))throw Error('Plugin discovery missing '+id);for(const id of packages)run(command,['plugin','remove',id+'@'+id+'-market'],env);}else{const config=run(command,['--profile','apd-general-test','--dump-config'],env);for(const id of packages)if(!config.includes('# == '+id))throw Error('Native plugin layer missing '+id);for(const id of packages)run(command,['plugin','--profile','apd-general-test','remove',id],env);}
}
mkdirSync('deliverables/harness',{recursive:true});writeFileSync('deliverables/harness/general-real-host-install.json',JSON.stringify(evidence,null,2));console.log('Actual isolated UI packages installed/discovered/removed in both hosts');
}catch(e){mkdirSync('deliverables/harness',{recursive:true});writeFileSync('deliverables/harness/general-real-host-install-failure.json',JSON.stringify({...evidence,error:e.message},null,2));throw e;}

/** Run from an isolated npm host install directory with @deepseek-ai/dsh@0.2.1-rc.5; see HARNESS.md. Real native runtime, scripted provider only. */
import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const evidenceRoot=process.env.APD_EVIDENCE_DIR||'/tmp/harness-native-evidence';
const fixtures=process.env.APD_HOST_FIXTURES||'/tmp/harness-install-fixtures';
const runRoot=evidenceRoot+'/run-'+Date.now();
const ctx=new Context(); const fibers=[]; const evidence={runRoot,classification:'actual DSH AgentLoop + actual spawn provider, scripted local LlmAdapter; no network or live model',version:JSON.parse(readFileSync('./node_modules/@deepseek-ai/dsh/package.json')).version,cases:[],calls:[],children:[],checks:[],structuredToolResults:[]};
for (const pkg of ['dsh-session-projection','dsh-session','dsh-system-prompt','dsh-tools','dsh-llm','dsh-agent','dsh-commands','dsh-fs-local','dsh-working-directory','dsh-agent-loop','dsh-subagent','dsh-subagent-spawn-in-process']) {const mod=await import('@deepseek-ai/'+pkg);const f=ctx.plugin(mod.default??mod,{});await f;fibers.push(f);}
for(const name of ['one','two']){const f=ctx.plugin(await import(fixtures+'/deepseek/apd-host-'+name+'/index.mjs'));await f;fibers.push(f);}
globalThis.fetch=async(...args)=>{throw Error('Network fetch forbidden in zero-cost native evidence fixture');};
const bundleIds=Object.fromEntries(['one','two'].map(n=>[n,JSON.parse(readFileSync(fixtures+'/deepseek/apd-host-'+n+'/bundle.json')).plugin.id]));
let active;const counts=new Map();
class Scripted extends LlmAdapter {
 async *stream(o){
 const user=o.messages.find(m=>m.role==='user'&&m.source?.kind!=='runtime-context'); let prompt;try{prompt=JSON.parse(user?.content?.find(c=>c.type==='text')?.text);}catch{}
 let block;
 if(prompt?.role&&active.mode==='interrupt'){setTimeout(()=>active.main.cancel({kind:'user'}),5);await new Promise(resolve=>{if(o.signal.aborted)resolve();else o.signal.addEventListener('abort',resolve,{once:true});});throw o.signal.reason;}else if(prompt?.role&&active.mode==='malformed'){block={type:'text',text:'Unstructured completion intentionally malformed'};}else if(prompt?.role){const role=prompt.role;const n=(counts.get(active.key+role)||0)+1;counts.set(active.key+role,n);const fail=role==='qa'&&(active.mode==='retry3'||(active.mode==='rework'&&n===1));const val={verdict:role==='developer'?'completed':fail?'failed':'passed',evidence:'scripted local evidence '+role+' '+n,checks:role==='qa'?prompt.criteria.map(criterion=>({criterion,passed:!fail,evidence:'local scripted check'})):[]};block={type:'tool-call',id:crypto.randomUUID(),name:'structured_output',arguments:val};
 }else if(active.invoke){active.invoke=false;block={type:'tool-call',id:crypto.randomUUID(),name:bundleIds[active.bundle].replaceAll('-','_')+'_run',arguments:{input:JSON.stringify(active.input)}};} else block={type:'text',text:'Main observed workflow result.'};
 evidence.calls.push({case:active.key,provider:o.provider,model:o.model,role:prompt?.role??'main',tool:block.name??null,parentContextLeak:prompt?.role?JSON.stringify(o.messages).includes('MAIN_PRIVATE_SENTINEL'):null});
 const index=0;yield {type:'block-start',index,blockType:block.type};if(block.type==='tool-call')yield {type:'tool-call-delta',index,id:block.id,name:block.name,argumentsDelta:JSON.stringify(block.arguments)};else yield {type:'text-delta',index,text:block.text};yield {type:'block-end',index,block};yield {type:'finish',reason:block.type==='tool-call'?'tool_calls':'stop'};
 }
}
ctx.llm.registerAdapter(['scripted'],new Scripted());
ctx.on('agent/error',(...x)=>console.log('AGENTERROR',...x));
ctx.on('session/created',s=>{evidence.children.push({case:active?.key,id:s.id,header:s.header});});
ctx.on('tools/result',(exec,result)=>{if(exec.name==='structured_output')evidence.structuredToolResults.push({case:active.key,sessionId:exec.agent.session.id,result});if(exec.name.endsWith('_run'))evidence.cases.push({case:active.key,mainSession:exec.agent.session.id,tool:exec.name,result});});
for(const [bundle,mode] of [['one','pass'],['two','rework'],['one','retry3'],['two','malformed'],['two','interrupt']]){
 const key=bundle+'-'+mode,workspace=runRoot+'/'+key;mkdirSync(workspace,{recursive:true});writeFileSync(workspace+'/candidate.txt','local deterministic candidate\n');
 active={key,bundle,mode,invoke:true,input:{taskId:key,task:'Validate local candidate',criteria:['candidate exists'],workspace,statePath:workspace+'/.apd/state.json'}};
 const a=await ctx.agentLoop.create('native-main-'+key,{provider:'scripted',model:'local'},{cwd:workspace});active.main=a;a.followup(createUserMessage({content:[{type:'text',text:'MAIN_PRIVATE_SENTINEL run workflow'}],source:{kind:'user'}}));await Promise.race([a.whenIdle(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('native host did not settle within 3 seconds')),3000);a.whenIdle().then(()=>clearTimeout(timer));})]);
 const state=JSON.parse(readFileSync(active.input.statePath,'utf8'));console.log(key,state.status,state.reworks);
 if(mode==='pass'){
  const before=evidence.children.length;active.invoke=true;a.followup(createUserMessage({content:[{type:'text',text:'Resume same workflow'}],source:{kind:'user'}}));await a.whenIdle();const after=JSON.parse(readFileSync(active.input.statePath));evidence.checks.push({case:key,check:'passed resume creates no children',passed:after.status==='passed'&&evidence.children.length===before});
 }
 if(mode==='retry3'){
  const rejected=await ctx.commands.execute(a,'/'+bundleIds.one+'-decide '+JSON.stringify({statePath:active.input.statePath,outcome:'passed',reason:'test cannot manufacture QA pass'}),[],new AbortController().signal);
  evidence.checks.push({case:key,check:'native human command rejects passed override',execution:rejected,state:JSON.parse(readFileSync(active.input.statePath)).status});
  const accepted=await ctx.commands.execute(a,'/'+bundleIds.one+'-decide '+JSON.stringify({statePath:active.input.statePath,outcome:'failed',reason:'scripted command test closes failed workflow'}),[],new AbortController().signal);
  evidence.checks.push({case:key,check:'native command records allowed failed decision; simulated human command admission',execution:accepted,state:JSON.parse(readFileSync(active.input.statePath)).status});
 }

}
writeFileSync(evidenceRoot+'/evidence.json',JSON.stringify(evidence,null,2));
for(const f of fibers.reverse())await f.dispose();
console.log('EVIDENCE /tmp/harness-native-evidence/evidence.json');

/** Actual DSH Session/AgentLoop/spawn integration with local scripted LLM; no external model. See HARNESS.md. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const evidenceRoot=process.env.APD_EVIDENCE_DIR||'/tmp/harness-native-evidence';
const fixtures=process.env.APD_HOST_FIXTURES||'/tmp/harness-install-fixtures';
const sourceRoot=process.env.APD_SOURCE_ROOT||'/workspace/agent-plugin-designer';
const runRoot=evidenceRoot+'/run-'+Date.now();
const ctx=new Context(); const fibers=[]; const evidence={runRoot,classification:'actual DSH AgentLoop + actual spawn provider, scripted local LlmAdapter; no network or live model',version:JSON.parse(readFileSync('./node_modules/@deepseek-ai/dsh/package.json')).version,cases:[],calls:[],children:[],checks:[],structuredToolResults:[]};
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
evidence.provenance={repoEngineSourceSha256:sha(sourceRoot+'/runtime/workflow.mjs'),repoRunnerSourceSha256:sha(sourceRoot+'/runtime/runner.mjs'),repoAdapterSourceSha256:sha(sourceRoot+'/runtime/deepseek.mjs'),bundles:Object.fromEntries(['one','two'].map(n=>{const root=fixtures+'/deepseek/apd-host-'+n,b=JSON.parse(readFileSync(root+'/bundle.json'));return [n,{id:b.plugin.id,version:b.plugin.version,predicates:b.predicates,bundleFileSha256:sha(root+'/bundle.json'),bundleCanonicalSha256:createHash('sha256').update(JSON.stringify(b)).digest('hex'),nativeEntrypointSha256:sha(root+'/index.mjs'),generatedEngineSha256:sha(root+'/scripts/workflow.mjs'),generatedRunnerSha256:sha(root+'/scripts/runner.mjs')}]}))};
for (const pkg of ['dsh-session-projection','dsh-session','dsh-system-prompt','dsh-tools','dsh-llm','dsh-agent','dsh-commands','dsh-fs-local','dsh-working-directory','dsh-agent-loop','dsh-subagent','dsh-subagent-spawn-in-process']) {const mod=await import('@deepseek-ai/'+pkg);const f=ctx.plugin(mod.default??mod,{});await f;fibers.push(f);}
for(const name of ['one','two']){const f=ctx.plugin(await import(fixtures+'/deepseek/apd-host-'+name+'/index.mjs'));await f;fibers.push(f);}
globalThis.fetch=async(...args)=>{throw Error('Network fetch forbidden in zero-cost native evidence fixture');};
const bundleIds=Object.fromEntries(['one','two'].map(n=>[n,JSON.parse(readFileSync(fixtures+'/deepseek/apd-host-'+n+'/bundle.json')).plugin.id]));
let active;const counts=new Map();
class Scripted extends LlmAdapter {
 async *stream(o){
 const user=o.messages.find(m=>m.role==='user'&&m.source?.kind!=='runtime-context'); let prompt;try{prompt=JSON.parse(user?.content?.find(c=>c.type==='text')?.text);}catch{}
 let block;
 if(prompt?.role==='developer'&&active.mode==='nested'&&!active.nestedAttempt){active.nestedAttempt=true;const nested={...active.input,taskId:active.key+'-nested-child',statePath:active.input.workspace+'/.apd/nested.json'};block={type:'tool-call',id:crypto.randomUUID(),name:bundleIds[active.bundle].replaceAll('-','_')+'_run',arguments:{input:JSON.stringify(nested)}};}else if(prompt?.role&&active.mode==='interrupt'){setTimeout(()=>active.main.cancel({kind:'user'}),5);await new Promise(resolve=>{if(o.signal.aborted)resolve();else o.signal.addEventListener('abort',resolve,{once:true});});throw o.signal.reason;}else if(prompt?.role&&active.mode==='malformed'){block={type:'text',text:'Unstructured completion intentionally malformed'};}else if(prompt?.role){const role=prompt.role;const n=(counts.get(active.key+role)||0)+1;counts.set(active.key+role,n);const fail=role==='qa'&&(active.mode==='retry3'||(active.mode==='rework'&&n===1));const val={verdict:role==='developer'?'completed':fail?'failed':'passed',evidence:'scripted local evidence '+role+' '+n,checks:role==='qa'?prompt.criteria.map(criterion=>({criterion,passed:!fail,evidence:'local scripted check'})):[]};block={type:'tool-call',id:crypto.randomUUID(),name:'structured_output',arguments:val};
 }else if(active.invoke){active.invoke=false;block={type:'tool-call',id:crypto.randomUUID(),name:bundleIds[active.bundle].replaceAll('-','_')+'_run',arguments:{input:JSON.stringify(active.input)}};} else block={type:'text',text:'Main observed workflow result.'};
 evidence.calls.push({case:active.key,provider:o.provider,model:o.model,role:prompt?.role??'main',tool:block.name??null,parentContextLeak:prompt?.role?JSON.stringify(o.messages).includes('MAIN_PRIVATE_SENTINEL'):null});
 const index=0;yield {type:'block-start',index,blockType:block.type};if(block.type==='tool-call')yield {type:'tool-call-delta',index,id:block.id,name:block.name,argumentsDelta:JSON.stringify(block.arguments)};else yield {type:'text-delta',index,text:block.text};yield {type:'block-end',index,block};yield {type:'finish',reason:block.type==='tool-call'?'tool_calls':'stop'};
 }
}
ctx.llm.registerAdapter(['scripted'],new Scripted());
ctx.on('agent/error',(...x)=>console.log('AGENTERROR',...x));
ctx.on('session/created',s=>{evidence.children.push({case:active?.key,id:s.id,header:s.header});});
ctx.on('tools/result',(exec,result)=>{if(exec.name==='structured_output')evidence.structuredToolResults.push({case:active.key,sessionId:exec.agent.session.id,result});if(exec.name.endsWith('_run'))evidence.cases.push({case:active.key,mainSession:exec.agent.session.id,tool:exec.name,result});});
for(const [bundle,mode] of [['one','pass'],['two','rework'],['one','retry3'],['two','malformed'],['two','interrupt'],['one','nested']]){
 const key=bundle+'-'+mode,workspace=runRoot+'/'+key;mkdirSync(workspace,{recursive:true});writeFileSync(workspace+'/candidate.txt','local deterministic candidate\n');
 active={key,bundle,mode,invoke:true,input:{taskId:key,task:'Validate local candidate',criteria:['candidate exists'],workspace,statePath:workspace+'/.apd/state.json'}};
 const a=await ctx.agentLoop.create('native-main-'+key,{provider:'scripted',model:'local'},{cwd:workspace});active.main=a;a.followup(createUserMessage({content:[{type:'text',text:'MAIN_PRIVATE_SENTINEL run workflow'}],source:{kind:'user'}}));await Promise.race([a.whenIdle(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('native host did not settle within 3 seconds')),3000);a.whenIdle().then(()=>clearTimeout(timer));})]);
 const state=JSON.parse(readFileSync(active.input.statePath,'utf8'));console.log(key,state.status,state.reworks);
 if(mode==='nested'){const nested=JSON.parse(readFileSync(workspace+'/.apd/nested.json'));const sessions=evidence.children.filter(c=>c.case===key&&c.header.origin==='subagent');evidence.nestedPolicy={configuredMaxDepth:ctx.subagents.resolveMaxDepth(undefined),rootStatus:state.status,nestedStatus:nested.status,nestedReason:nested.reason,nestedStatePath:workspace+'/.apd/nested.json',nestedDispatchCount:nested.events.filter(e=>e.type==='dispatch').length,childSessions:sessions.map(c=>({id:c.id,parent:c.header.parentSession,delegationDepth:c.header.delegationDepth})),noDepth2:sessions.every(c=>c.header.delegationDepth===1)};console.log('nestedPolicy',JSON.stringify(evidence.nestedPolicy));}
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
const captured=evidence.cases.map(c=>({name:c.case,state:c.result.value?JSON.parse(c.result.value):null}));
for(const [name,status,count]of [['one-pass','passed',0],['two-rework','passed',1],['one-retry3','human_paused',3],['two-malformed','blocked',0]]){const s=captured.find(c=>c.name===name).state;assert.equal(s.status,status);assert.equal(s.reworks,count);}
const childSessions=evidence.children.filter(c=>c.header.origin==='subagent');assert.equal(new Set(childSessions.map(c=>c.id)).size,childSessions.length);assert(childSessions.every(c=>c.header.isSeeded===false));assert(evidence.calls.filter(c=>c.role!=='main').every(c=>c.parentContextLeak===false));assert(evidence.structuredToolResults.every(t=>!t.result.isError));assert(evidence.checks[0].passed);assert.equal(evidence.checks[1].execution.result.kind,'error');assert.equal(evidence.checks[2].state,'failed');assert.equal(JSON.parse(readFileSync(runRoot+'/two-interrupt/.apd/state.json')).status,'blocked');assert.equal(evidence.nestedPolicy.configuredMaxDepth,1);assert.equal(evidence.nestedPolicy.rootStatus,'passed');assert.equal(evidence.nestedPolicy.nestedStatus,'blocked');assert.match(evidence.nestedPolicy.nestedReason,/depth/i);assert.equal(evidence.nestedPolicy.nestedDispatchCount,0);assert(evidence.nestedPolicy.noDepth2);
writeFileSync(evidenceRoot+'/evidence.json',JSON.stringify(evidence,null,2));
for(const f of fibers.reverse())await f.dispose();
console.log('EVIDENCE '+evidenceRoot+'/evidence.json');

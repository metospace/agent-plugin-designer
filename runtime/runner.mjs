import {bounded,executionLimits} from './limits.mjs';
import {graphContext,getPath} from './graph.mjs';
import { createRun, advance, digest, persist, loadState } from './workflow.mjs';
import { existsSync, readdirSync, readFileSync, writeFileSync, lstatSync, openSync, closeSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
export const resultSchema = {type:'object',additionalProperties:false,required:['verdict','evidence','checks'],properties:{verdict:{type:'string',enum:['completed','passed','failed']},evidence:{type:'string'},checks:{type:'array',items:{type:'object',additionalProperties:false,required:['criterion','passed','evidence'],properties:{criterion:{type:'string'},passed:{type:'boolean'},evidence:{type:'string'}}}}}};
// Hash bytes, not agent claims. State is outside candidate roots. Ignore only standard VCS/dependency metadata.
export function candidateHash(root){const entries=[];function walk(path,rel=''){for(const name of readdirSync(path).sort()){if(['.git','node_modules','.apd'].includes(name))continue;const child=join(path,name),r=rel+'/'+name,stat=lstatSync(child);if(stat.isSymbolicLink())throw Error('candidate symlink unsupported: '+r);if(stat.isDirectory())walk(child,r);else if(stat.isFile())entries.push([r,digest(readFileSync(child))]);}}walk(resolve(root));return digest(entries);}
export async function runTask(bundle,input,host){
 const root=resolve(input.workspace),statePath=resolve(input.statePath);
 if(!statePath.startsWith(join(root,'.apd')+'/')&&!statePath.startsWith(join(root,'.apd')+'\\'))throw Error('state must be inside workspace/.apd/');
 mkdirSync(join(root,'.apd'),{recursive:true});
 mkdirSync(dirname(statePath),{recursive:true});
 const registry=join(root,'.apd','task-'+digest(input.mainSession+'\0'+input.taskId)+'.binding.json');
 const binding={taskId:input.taskId,mainSession:input.mainSession,bundleHash:digest(bundle),statePath};
 try{writeFileSync(registry,JSON.stringify(binding),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;const existing=JSON.parse(readFileSync(registry,'utf8'));if(JSON.stringify(existing)!==JSON.stringify(binding))throw Error('Task already bound to another plugin/version/state path');}
 const lock=statePath+'.lock';let fd;try{fd=openSync(lock,'wx');}catch{throw Error('Task already running or interrupted: inspect task lock and host child before manually removing lock');}
 try{
 let s=existsSync(statePath)?loadState(statePath):createRun(bundle,input);
 if(s.bundleHash!==digest(bundle)||s.taskId!==input.taskId||s.task!==input.task||s.mainSession!==input.mainSession||s.criteriaHash!==digest(input.criteria))throw Error('resume identity/criteria changed');
 const apply=e=>{s=advance(bundle,s,{id:crypto.randomUUID(),...e});persist(statePath,s);};
 persist(statePath,s);
 if(bundle.schemaVersion===3)return await runGraphTask(bundle,input,host,s,apply,()=>s);
 if(['passed','accepted_with_risk'].includes(s.status)&&candidateHash(root)!==s.candidate.hash)apply({type:'candidate_changed',candidate:candidateHash(root)});
 if(['developer_running','qa_running'].includes(s.status)){apply({type:'blocked',reason:'Interrupted host child; inspect recorded child before explicit retry_dispatch'});return s;}
 if(!['developer_pending','qa_pending'].includes(s.status))return s;
 try{await host.check();}catch(e){apply({type:'blocked',reason:e.message});return s;}
 while(['developer_pending','qa_pending'].includes(s.status)){
  const role=s.status==='developer_pending'?'developer':'qa';
  if(role==='qa'&&candidateHash(root)!==s.candidate.hash){apply({type:'candidate_changed',candidate:candidateHash(root)});continue;}
  const roleDefinition=bundle.source.roles.find(r=>r.id===bundle.execution[role==='qa'?'qaRoleId':'developerRoleId']);
  const prompt=JSON.stringify({role,definition:roleDefinition,skills:roleDefinition.bindings.map(b=>({binding:b,skill:bundle.source.skills.find(x=>x.id===b.skillId)?.versions.find(v=>v.version===b.version)})),task:s.task,criteria:s.criteria,candidate:s.candidate?.hash,criteriaHash:s.criteriaHash,feedback:s.qa,requirements:role==='qa'?'Inspect exact candidate independently. Do not modify any file. Return checks for every original criterion, verdict passed iff every check passed.':'Implement original task, run validation, return verdict completed and evidence. Never claim QA passed.'});
  let child;
  try{
   child=await host.start({role,prompt,schema:resultSchema,workspace:root});
   apply({type:'dispatch',role,sessionId:child.id,policy:child.policy??'host-native-permissions'});
   const result=await child.result;
   if(result.stopReason!=='completed'||!result.structured)throw Error('Malformed/interrupted host output');
   const value=result.structured;
   if(role==='developer'){
    if(value.verdict!=='completed')throw Error('Developer did not complete');
    apply({type:'developer_result',sessionId:child.id,status:'completed',candidate:candidateHash(root),evidence:value.evidence});
   }else{
    const actual=candidateHash(root);
    if(actual!==s.candidate.hash){apply({type:'candidate_changed',candidate:actual});throw Error('Candidate changed during QA; evidence invalidated');}
    apply({type:'qa_result',sessionId:child.id,candidate:actual,criteriaHash:s.criteriaHash,verdict:value.verdict,evidence:value.evidence,checks:value.checks});
   }
  }catch(e){apply({type:'blocked',reason:e.message});return s;}finally{if(child)await child.dispose();}
 }
 return s;
 }finally{closeSync(fd);unlinkSync(lock);}
}

function graphSchema(config){const fields=config.outputFields??[{name:'text',type:'string'}];const properties={};for(const field of fields){if(field.type==='object')properties[field.name]={type:'object',additionalProperties:false,properties:{},required:[]};else if(field.type==='array')properties[field.name]={type:'array',items:{type:'string'}};else properties[field.name]={type:field.type};}return {type:'object',additionalProperties:false,required:['status','data'],properties:{status:{type:'string',enum:['completed']},data:{type:'object',additionalProperties:false,required:fields.map(f=>f.name),properties}}};}
async function runGraphTask(bundle,input,host,initial,apply,current){
 let s=initial;
 if(!s.runtime){apply({type:'runtime_init',limits:input.limits});s=current();}
 if(input.limits&&JSON.stringify(executionLimits(input.limits))!==JSON.stringify(s.runtime.limits))throw Error('Resume execution limits changed; start a new task');
 const limits=s.runtime.limits,remaining=()=>limits.timeoutMs-(Date.now()-s.runtime.startedAt);
 const block=error=>{if(current().status!=='blocked')apply({type:'blocked',reason:error.message??String(error)});};
 const timed=(operation,label,cap=limits.dispatchTimeoutMs,onLate,onTimeout)=>{if(remaining()<=0)throw Error('Graph time budget exhausted');return bounded(operation,Math.min(cap,remaining()),label,onLate,onTimeout);};
 const cleanup=child=>bounded(()=>child.dispose?.(),limits.cleanupTimeoutMs,'Child cleanup');
 const verifyReview=()=>{const reviews=bundle.source.nodes.filter(n=>n.data.config?.review),snapshots=[...(current().tokens??[]).map(t=>t.nodes),...(current().terminals??[]).map(t=>t.nodes)];for(const n of reviews)for(const nodes of snapshots){const result=nodes?.[n.id]?.data;if(result?.candidate&&result.candidate!==candidateHash(input.workspace)){apply({type:'review_invalidated'});return false;}}return true;};
 if(['passed','accepted_with_risk'].includes(s.status)&&!verifyReview())return current();
 if(s.tokens.some(t=>['dispatching','running'].includes(t.phase))){apply({type:'blocked',reason:'Interrupted dispatch; inspect persisted intent and real child session before explicit retry_dispatch'});return current();}
 if(s.status!=='running')return s;
 try {
 try{await timed(()=>host.check(),'Host check',limits.hostCheckTimeoutMs);apply({type:'tick'});}catch(e){block(e);return current();}
 s=current();
 while(s.status==='running'){
  const ready=s.tokens.filter(t=>t.phase==='ready'&&bundle.source.nodes.find(n=>n.id===t.nodeId)?.data.kind==='agent');
  if(!ready.length){apply({type:'blocked',reason:'Graph cannot advance: unmatched join or unresolved frontier'});return current();}
  if(remaining()<=0){block(Error('Graph time budget exhausted'));return current();}
  if(s.runtime.dispatches+ready.length>limits.maxDispatches){block(Error('Graph dispatch budget exhausted'));return current();}
  const jobs=[];
  for(const token of ready){const node=bundle.source.nodes.find(n=>n.id===token.nodeId),config=node.data.config??{},roleDefinition=bundle.source.roles.find(r=>r.id===node.data.roleId);if(token.frames.length&&config.permissions==='workspace-write'){apply({type:'blocked',reason:'Parallel file writes require separate isolation; shared workspace branches are read-only'});return current();}const context=graphContext(s,token),inputs={};for(const [name,path]of Object.entries(config.inputs??{})){const value=getPath(context,path);if(value===undefined){apply({type:'blocked',reason:'Missing input '+path});return current();}inputs[name]=value;}const review=config.review;const candidate=review?candidateHash(input.workspace):null;if(review&&(getPath(context,review.candidateFrom)!==candidate||!Array.isArray(getPath(context,review.criteriaFrom))||digest(getPath(context,review.criteriaFrom))!==s.criteriaHash)){apply({type:'blocked',reason:'Review candidate or criteria binding changed or missing'});return current();}let schema=review?resultSchema:graphSchema(config);const role=review?'qa':config.permissions==='workspace-write'?'developer':'agent';const prompt=JSON.stringify({nodeId:node.id,step:{label:node.data.label,description:node.data.description,delivery:node.data.delivery??''},role,definition:roleDefinition,skills:roleDefinition.bindings.map(b=>({binding:b,skill:bundle.source.skills.find(x=>x.id===b.skillId)?.versions.find(v=>v.version===b.version)})),task:s.task,criteria:s.criteria,input:inputs,context:{data:context.data,nodes:context.nodes,input:context.input},candidate,criteriaHash:s.criteriaHash,stepRequirements:'Follow the step description. Delivery notes supplement explicit role output requirements and the supplied output schema, and never grant permissions or override independent review requirements.',requirements:review?'Inspect candidate independently without modifying any file. Return checks for all original criteria.':'Complete configured node. Return status completed and data matching the supplied schema. Permissions are host policy; do not modify files unless explicitly granted workspace-write.'});jobs.push({token,node,config,candidate,review,role,prompt,schema});}
  // Persist every intent BEFORE any host invocation; resume never silently duplicates an ambiguous dispatch.
  try{for(const job of jobs)apply({type:'dispatch_intent',tokenId:job.token.id});}catch(e){block(e);return current();}
  let blocked=false;
  await Promise.all(jobs.map(async job=>{let child;const controller=new AbortController();try{const dispatchDeadline=Date.now()+Math.min(limits.dispatchTimeoutMs,remaining());child=await timed(()=>host.start({role:job.role,permission:job.config.permissions??'read-only',prompt:job.prompt,schema:job.schema,workspace:input.workspace,signal:controller.signal}),'Host start',limits.dispatchTimeoutMs,cleanup,()=>controller.abort());apply({type:'dispatch',tokenId:job.token.id,sessionId:child.id,policy:child.policy??'host-native-permissions'});const result=await timed(()=>child.result,'Child result',Math.max(1,dispatchDeadline-Date.now()),undefined,()=>controller.abort());if(result.stopReason!=='completed'||!result.structured)throw Error('Malformed/interrupted host output');let value=result.structured;if(job.review){if(candidateHash(input.workspace)!==job.candidate)throw Error('Candidate changed during independent review');if(!['passed','failed'].includes(value.verdict)||!Array.isArray(value.checks)||value.checks.length!==s.criteria.length||!value.checks.every((x,i)=>x.criterion===s.criteria[i]&&typeof x.passed==='boolean'&&x.evidence)||value.verdict!==(value.checks.every(x=>x.passed)?'passed':'failed'))throw Error('Review must bind every original criterion with evidence');value={status:'completed',data:{...value,candidate:job.candidate,criteriaHash:s.criteriaHash}};}else if(job.config.permissions==='workspace-write'){value={...value,data:{...value.data,candidate:candidateHash(input.workspace)}};}apply({type:'result',tokenId:job.token.id,sessionId:child.id,result:value});}catch(e){controller.abort();blocked=true;if(current().status!=='blocked')apply({type:'blocked',reason:e.message});}finally{if(child)try{await cleanup(child);}catch(e){apply({type:'cleanup_warning',reason:e.message});}}}));
  s=current();if(blocked)return s;if(['passed','accepted_with_risk'].includes(s.status)&&!verifyReview())return current();
 }
 return s;
 }catch(e){block(e);return current();}
}

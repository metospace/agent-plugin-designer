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

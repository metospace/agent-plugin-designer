import {createInterface} from 'node:readline/promises';
import {readFileSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {advance,loadState,persist} from './workflow.mjs';

export function recoverySummary(state){
 return {status:state.status,reason:state.reason,runtime:state.runtime,children:state.tokens?.filter(t=>t.dispatch).map(t=>({tokenId:t.id,nodeId:t.nodeId,phase:t.phase,...t.dispatch}))??(state.dispatch?[state.dispatch]:[]),warning:'Inspect actual host sessions and stop unresolved children first. Retry preserves budgets and never starts a child itself.'};
}
export function retryInspectedTask(bundle,state,{inspected,reason}){
 if(state.status!=='blocked')throw Error('Task is not blocked');
 if(inspected!==true)throw Error('Explicit confirmation that actual children were inspected and stopped is required');
 if(typeof reason!=='string'||!reason.trim())throw Error('A recovery reason is required');
 const r=state.runtime;
 if(r&&(r.steps>=r.limits.maxSteps||r.dispatches>=r.limits.maxDispatches||Date.now()-r.startedAt>=r.limits.timeoutMs))throw Error('Execution budget exhausted: retry cannot reset budgets; start a new task after inspecting and stopping existing children');
 return advance(bundle,state,{id:crypto.randomUUID(),type:'retry_dispatch',actor:'human',inspected:true,reason:reason.trim()});
}
export async function humanCommand(bundlePath,statePath){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Human decisions require an interactive terminal. Use the native human command in DeepSeek.');
 const lock=statePath+'.lock';let fd;
 try{fd=openSync(lock,'wx');}catch{throw Error('Task is running or interrupted: inspect the task lock and host children before recovery');}
 let rl;
 try{
  const bundle=JSON.parse(readFileSync(bundlePath,'utf8')),state=loadState(statePath);
  if(!['blocked','human_paused'].includes(state.status))throw Error('Task is not blocked or paused for a human');
  rl=createInterface({input:process.stdin,output:process.stdout});
  if(state.status==='blocked'){
   console.log(JSON.stringify(recoverySummary(state),null,2));
   const confirmation=await rl.question('Have you inspected actual host children and stopped all unresolved work? Type INSPECTED AND STOPPED to enable explicit retry: ');
   const reason=await rl.question('Recovery reason: ');
   persist(statePath,retryInspectedTask(bundle,state,{inspected:confirmation==='INSPECTED AND STOPPED',reason}));
   console.log('Retry prepared. Counters and deadline preserved. Invoke the runner separately when ready.');
  }else{
   console.log(JSON.stringify({status:state.status,candidate:state.candidate,failedQA:state.qa,pendingNodes:state.tokens?.filter(t=>t.phase==='human').map(t=>t.nodeId)},null,2));
   const outcome=await rl.question('Outcome (continue / accepted_with_risk / failed / cancelled): ');
   const nodeId=state.tokens?.filter(t=>t.phase==='human').length>1?await rl.question('Paused node ID: '):undefined;
   const reason=await rl.question('Reason: ');
   persist(statePath,advance(bundle,state,{id:crypto.randomUUID(),type:'human',actor:'human',outcome,reason,nodeId}));console.log(outcome);
  }
 }finally{rl?.close();closeSync(fd);unlinkSync(lock);}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 try{await humanCommand(...process.argv.slice(2));}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
}

import {defineTool} from '@deepseek-ai/dsh-tools';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {advance,loadState,persist} from './scripts/workflow.mjs';
import {runTask} from './scripts/runner.mjs';
const bundle=JSON.parse(readFileSync(new URL('./bundle.json',import.meta.url),'utf8'));
export const name=bundle.plugin.id;
export const inject=['tools','commands','subagents'];
export function apply(ctx){
 ctx.commands.register({name:name+'-decide',description:'Human-only decision for paused workflow. JSON: {statePath,outcome,reason}',input:{hint:'JSON decision'},async handler(invocation){try{const args=JSON.parse(invocation.rawInput.trim()),state=loadState(args.statePath);if(state.mainSession!==String(invocation.agent.session.id))throw Error('Decision must come from the task owning host session');const next=advance(bundle,state,{id:String(invocation.commandId),type:'human',actor:'human',outcome:args.outcome,reason:args.reason,hostCommandId:String(invocation.commandId)});persist(args.statePath,next);return {kind:'success',text:next.status};}catch(e){return {kind:'error',text:e.message};}}});
 ctx.tools.register(defineTool({
 name:name.replaceAll('-','_')+'_run',
 description:'Explicitly select this frozen developer/independent-QA workflow for one task. Executes through native independent subagents and deterministic persisted routing; stops at human pause or blocked. Never changes permissions.',
 parameters:{input:{type:'string',required:true,description:'JSON {taskId,task,criteria:[strings],workspace:absolute path,statePath:workspace/.apd/task.json}. Same values resume the task.'}},
 output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
 async execute(args,exec){
 if(!exec.agent)throw Error('Calling main host agent required');
 const input=JSON.parse(args.input);input.mainSession=String(exec.agent.session.id);
 const host={
 async check(){const p=ctx.subagents?.getProvider('spawn');if(!p||p.inheritsParentContext||!p.capabilities.outputSchema||(ctx.subagents.resolveMaxDepth(undefined)!==undefined&&!p.capabilities.depthLimit))throw Error('Missing independent spawn provider with structured output; no same-session fallback');},
 async start({role,prompt,schema,workspace}){
 const maxDepth=ctx.subagents.resolveMaxDepth(undefined);
 const activation=await ctx.subagents.startActivation({provider:'spawn',label:name+' '+role,request:{prompt:[{type:'text',text:prompt}],parent:exec.agent,cwd:workspace,outputSchema:schema,...maxDepth===undefined?{}:{maxDepth}},signal:exec.signal,delivery:'caller'});
 const abort=()=>{void activation.dispose().catch(()=>{});};exec.signal.addEventListener('abort',abort,{once:true});if(exec.signal.aborted)abort();return {id:String(activation.childId),result:activation.result,async dispose(){exec.signal.removeEventListener('abort',abort);await activation.dispose();}};
 }};
 return JSON.stringify(await runTask(bundle,input,host));
 }
 }));
}

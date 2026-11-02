import {createInterface} from 'node:readline/promises';import {readFileSync} from 'node:fs';import {advance,loadState,persist} from './workflow.mjs';
if(!process.stdin.isTTY||!process.stdout.isTTY){process.stderr.write('Human decisions require an interactive terminal. Use the native human command in DeepSeek.\n');process.exit(1);}
const [bundlePath,statePath]=process.argv.slice(2),bundle=JSON.parse(readFileSync(bundlePath,'utf8')),state=loadState(statePath);
if(state.status!=='human_paused')throw Error('Task is not paused for a human');
const rl=createInterface({input:process.stdin,output:process.stdout});
try{console.log(JSON.stringify({status:state.status,candidate:state.candidate,failedQA:state.qa},null,2));const outcome=await rl.question('Outcome (accepted_with_risk / failed / cancelled): ');const reason=await rl.question('Reason: ');persist(statePath,advance(bundle,state,{id:crypto.randomUUID(),type:'human',actor:'human',outcome,reason}));console.log(outcome);}finally{rl.close();}

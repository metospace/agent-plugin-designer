/** Deliberate compatibility probe, NOT a bypass of the production adapter version gate. */
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
if(process.env.APD_RUN_REAL_MODEL!=='1')throw Error('Set APD_RUN_REAL_MODEL=1 to authorize one bounded synthetic native compatibility probe.');
const command=process.env.APD_CODEX_BIN??'codex',dir=mkdtempSync(join(tmpdir(),'apd-native-probe-'));
spawnSync('git',['init','-q',dir]);
const schema={type:'object',additionalProperties:false,required:['answer'],properties:{answer:{type:'integer'}}};
writeFileSync(join(dir,'schema.json'),JSON.stringify(schema));
const report={classification:'NATIVE CODEX COMPATIBILITY PROBE ATTEMPT; REAL MODEL EXECUTION NOT ASSUMED',version:spawnSync(command,['--version'],{encoding:'utf8',timeout:10000}).stdout.trim(),model:'gpt-6.1-sol',provider:'OpenAI default with --ignore-user-config',timeoutMs:60000,events:[],passed:false};
const args=['exec','--ignore-user-config','--ephemeral','--json','--sandbox','read-only','--model',report.model,'--cd',dir,'--output-schema',join(dir,'schema.json'),'--output-last-message',join(dir,'result.json'),'Synthetic compatibility check only. Do not use any tool, access files, or make network requests yourself. Return answer equal to 2 + 3 in the supplied JSON schema.'];
const child=spawn(command,args,{stdio:['ignore','pipe','pipe'],shell:false});let stdout='',stderr='',timedOut=false;
child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-4096);});
let escalation;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');escalation=setTimeout(()=>child.kill('SIGKILL'),2000);},60000);
await new Promise(resolve=>{child.once('error',e=>{report.error=e.message;resolve();});child.once('close',(code,signal)=>{report.exitCode=code;report.signal=signal;resolve();});});clearTimeout(timer);clearTimeout(escalation);
report.timedOut=timedOut;report.stderr=stderr;for(const line of stdout.split('\n'))try{const e=JSON.parse(line);report.events.push({type:e.type,...e.thread_id?{threadId:e.thread_id}:{},...e.usage?{usage:e.usage}:{},...e.error?{error:e.error}:{}});}catch{}
if(existsSync(join(dir,'result.json')))try{report.result=JSON.parse(readFileSync(join(dir,'result.json'),'utf8'));}catch{report.error='Invalid structured output';}
report.observedModelCompletion=report.events.some(e=>e.type==='turn.completed');
report.passed=!timedOut&&report.exitCode===0&&report.events.some(e=>e.type==='thread.started')&&report.events.some(e=>e.type==='turn.completed')&&report.result?.answer===5;
const out=resolve('deliverables/evaluation/native-codex-probe.json');mkdirSync(resolve(out,'..'),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=2;

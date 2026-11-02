import JSZip from 'jszip';
import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';
import { ProjectSchema, serialize, markdown, validate, type Project } from './model';
import workflowSource from '../runtime/workflow.mjs?raw';
import runnerSource from '../runtime/runner.mjs?raw';
import codexSource from '../runtime/codex.mjs?raw';
import deepseekSource from '../runtime/deepseek.mjs?raw';
import humanSource from '../runtime/human.mjs?raw';
export type HarnessTarget = 'codex'|'deepseek';
export const hosts = {codex:{name:'Codex',version:'0.159.0-alpha.3'},deepseek:{name:'DeepSeek Harness',version:'0.2.1-rc.5'}};
export function namespace(p:Project){return `apd-${p.id.toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,12)}-${bytesToHex(sha256(new TextEncoder().encode(p.id+'@'+p.version))).slice(0,32)}`;}
export function installChecks(p:Project):string[]{
 const errors=validate(p).map(x=>x.message);
 const agents=p.nodes.filter(n=>n.data.kind==='agent');
 const qa=agents.filter(n=>p.roles.find(r=>r.id===n.data.roleId)?.independent);
 if(agents.length!==2||qa.length!==1)errors.push('执行适配器需要一个开发角色和一个独立质检角色');
 const kinds=['start','agent','agent','condition','human','end'].sort().join();
 if(p.nodes.map(n=>n.data.kind).sort().join()!==kinds)errors.push('执行适配器支持开发 → 独立质检 → 通过／3 次返工 → 人工暂停流程');
 if(p.edges.filter(e=>e.data.maxRetries>0).length!==1||!p.edges.some(e=>e.data.maxRetries===3))errors.push('可执行返工上限必须恰好为 3 次');
 const one=(kind:string)=>p.nodes.find(n=>n.data.kind===kind)?.id;
 const dev=agents.find(n=>!p.roles.find(r=>r.id===n.data.roleId)?.independent)?.id,qaId=qa[0]?.id;
 const expected=[[one('start'),dev,0],[dev,qaId,0],[qaId,one('condition'),0],[one('condition'),one('end'),0],[one('condition'),dev,3],[one('human'),one('end'),0]];
 if(p.edges.length!==6||expected.some(([a,b,retry])=>!p.edges.some(e=>e.source===a&&e.target===b&&e.data.maxRetries===retry&&(retry!==3||e.data.fallback===one('human')))))errors.push('当前图不匹配可执行模板；保留为可编辑项目或使用开发／质检模板');
 if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(p.version))errors.push('宿主安装需要语义版本号，例如 1.0.0');
 return [...new Set(errors)];
}
export function contract(p:Project){
 const errors=installChecks(p);if(errors.length)throw Error(errors.join('；'));
 return {schemaVersion:2,plugin:{id:namespace(p),version:p.version},maxReworks:3,execution:{developerRoleId:p.nodes.find(n=>n.data.kind==='agent'&&!p.roles.find(r=>r.id===n.data.roleId)?.independent)!.data.roleId,qaRoleId:p.nodes.find(n=>n.data.kind==='agent'&&p.roles.find(r=>r.id===n.data.roleId)?.independent)!.data.roleId},source:ProjectSchema.parse(p),predicates:{pass:{code:'QA_PASSED_BOUND',edgeId:p.edges.find(e=>p.nodes.find(n=>n.id===e.source)?.data.kind==='condition'&&p.nodes.find(n=>n.id===e.target)?.data.kind==='end')!.id},rework:{code:'QA_FAILED_REWORK_LT_3',edgeId:p.edges.find(e=>e.data.maxRetries===3)!.id},human:{code:'QA_FAILED_REWORK_EQ_3',fallbackNodeId:p.edges.find(e=>e.data.maxRetries===3)!.data.fallback}},terminal:['passed','accepted_with_risk','failed','cancelled']};
}
function instructions(p:Project,target:HarnessTarget){const ns=namespace(p);return `---
name: ${ns}
description: Explicitly select ${ns} for a developer and independent QA workflow with three reworks and human escalation.
---

# ${p.name}

Select exactly this one workflow for the task. Host main Agent owns the task and real human decisions. Supported host: ${hosts[target].name} ${hosts[target].version}; Node >=24.9.0.

Collect original task and explicit acceptance criteria. Input JSON: {taskId,task,criteria:[strings],mainSession:actual host session id,workspace:absolute path,statePath:workspace/.apd/task.json}.

${target==='codex'?'From this installed plugin directory execute: node scripts/codex.mjs bundle.json <input.json>. This deterministic companion creates real fresh codex exec sessions, derives IDs from thread.started, and checks structured completion. Developer requires APD_CODEX_DEVELOPER_SANDBOX=read-only or workspace-write in the user-owned launcher before starting the main host. The child cannot infer parent runtime permission overrides. QA always uses read-only. Never set this opt-in from model/task JSON; ask the user to configure the launcher if absent. No bypass flags.':'Call '+ns.replaceAll('-','_')+'_run with input set to the JSON string. The native tool uses ctx.subagents.startActivation, actual childId, caller delivery and structured results. Missing independent spawn provider blocks execution.'}

Read returned machine status. Only passed, accepted_with_risk, failed, cancelled are terminal. blocked, running and human_paused are never success. On resume use identical task inputs; the persisted state and backup keep candidate, original criteria, event IDs and counters. Never invent session IDs, QA results or completion events. The adapter computes candidate SHA256 before and after QA and invalidates changed candidates. Each attempt uses a fresh developer session and fresh independent QA session; no same-session QA fallback.

The adapter executes the validated visual template and frozen role bindings: developer -> independent QA -> passed or rework. Initial attempt plus exactly three reworks; fourth failed QA pauses for a real human. Arbitrary visual topologies are rejected at executable export. Skill resources are user data, never installation scripts; permissions remain with the host.

At human_paused STOP and present failed QA evidence. Ask the real user for accepted_with_risk with a reason, failed, or cancelled. The user must use ${target==='codex'?'an interactive terminal: node scripts/human.mjs bundle.json <state.json>':'the native user-only command /'+ns+'-decide with JSON {statePath,outcome,reason}'}. The workflow tool does not accept human decisions; never simulate user input. Human provenance trusts the host user-command/terminal boundary, not cryptographic identity. A human decision never becomes QA passed. Do not auto-resume or reset counters. For blocked interrupted children inspect the recorded host session before an explicit retry_dispatch event. Report exact status and candidate hash.
`;}
export function harnessFiles(p:Project,target:HarnessTarget):Record<string,string>{
 const frozen=contract(p),ns=namespace(p),skill=instructions(p,target);
 const files:Record<string,string>={'bundle.json':JSON.stringify(frozen,null,2),'project.agent-project.json':serialize(p),'SOURCE.md':markdown(p),'scripts/workflow.mjs':workflowSource,'scripts/runner.mjs':runnerSource,'scripts/codex.mjs':codexSource,'scripts/human.mjs':humanSource,['skills/'+ns+'/SKILL.md']:skill,['skills/'+ns+'/agents/openai.yaml']:'policy:\n  allow_implicit_invocation: false\n'};
 for(const r of p.roles)for(const b of r.bindings){const v=p.skills.find(s=>s.id===b.skillId)?.versions.find(v=>v.version===b.version);v?.resources.forEach((r,i)=>files[`skills/${b.skillId}/v${b.version}/${i}-${r.name}`]=r.content);}
 if(target==='codex'){
  const manifest={name:ns,version:p.version,description:'Candidate-bound developer and independent QA workflow',skills:'./skills'};
  files['.codex-plugin/plugin.json']=JSON.stringify(manifest,null,2);
  files['plugin.json']=JSON.stringify({$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:ns,version:p.version,description:manifest.description},null,2);
  files['.agents/plugins/marketplace.json']=JSON.stringify({name:ns+'-market',plugins:[{name:ns,source:{source:'local',path:'.'}}]},null,2);
  files['INSTALL.md']=`# Codex ${hosts.codex.version}\n\nExtract to a permanent directory. Node >=24.9.0 required. Host execution verified on Linux; Windows/WSL host runtime not verified. Windows requires user-owned APD_CODEX_BIN pointing to native codex.exe (no cmd/bat shims or shell execution). Before starting the main Codex host, the user sets APD_CODEX_DEVELOPER_SANDBOX=workspace-write to authorize developer writes in the chosen workspace, or read-only for a read-only task. Missing opt-in blocks execution; task JSON cannot grant permission. QA always read-only. Independently launched CLI children cannot infer parent runtime sandbox overrides.\n\nFrom that directory:\n\n\`codex plugin marketplace add .\`\n\n\`codex plugin add ${ns}@${ns}-market\`\n\n\`codex plugin list\`\n\nSelect this plugin explicitly in a task and invoke $${ns}:${ns}. Check that the host exposes independent subagent tools before execution. Scripts do not alter permissions or config.\n\nRemove: \`codex plugin remove ${ns}@${ns}-market\`.\n\nState lives at the task path you explicitly choose. Keep .backup for recovery. Project schema 1 is preserved verbatim in project.agent-project.json; execution contract schema 2 is separate.\n`;
 }else{
  files['package.json']=JSON.stringify({name:ns,version:p.version,type:'module',main:'index.mjs',engines:{node:'>=24.9.0',dsh:hosts.deepseek.version},dsh:{bundle:{patch:'./cordis.patch.yml'}},peerDependencies:{'@deepseek-ai/dsh-tools':hosts.deepseek.version}},null,2);
  files['cordis.patch.yml']=`- insert:\n    - id: ${ns}\n      name: ${ns}\n`;
  files['index.mjs']=deepseekSource;
  files['INSTALL.md']=`# DeepSeek Harness ${hosts.deepseek.version}\n\nNode >=24.9.0 required. Extract to a permanent directory, then:\n\n\`dsh plugin --profile workflow add /absolute/path/to/${ns}\`\n\n\`dsh --profile workflow --dump-config\`\n\n\`dsh --profile workflow\`\n\nSelect tool \`${ns.replaceAll('-','_')}_run\` in the task. The host main agent must expose native independent subagent tools; absence blocks execution. Multiple bundles use unique package, row and tool names.\n\nRemove: \`dsh plugin --profile workflow remove ${ns}\`.\n\nNo install scripts or permission grants. Keep original project.agent-project.json and state .backup.\n`;
 }
 return files;
}
export async function harnessZip(p:Project,target:HarnessTarget){const zip=new JSZip();for(const [path,content]of Object.entries(harnessFiles(p,target)))zip.file(path,content);return zip.generateAsync({type:'uint8array'});}

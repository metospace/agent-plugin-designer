import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import JSZip from 'jszip';
import {seed,validate,serialize,parseProject,markdown,runtimeZip,saveLibrary,loadLibrary,needsZip} from './model';
describe('project format',()=>{
 it('retains layout, all versions, bindings and bounded rework across round-trip',()=>{const p=seed();p.skills[0].versions.push({version:2,definition:'new version',resources:[]});expect(parseProject(serialize(p))).toEqual(p);});
 it('rejects corrupt, unknown versions and unsafe IDs',()=>{expect(()=>parseProject('{')).toThrow();const p=seed();expect(()=>parseProject(JSON.stringify({...p,schemaVersion:2}))).toThrow();p.skills[0].id='../escape';expect(()=>parseProject(JSON.stringify(p))).toThrow();});
 it('rejects duplicate node and skill version identities',()=>{const p=seed();p.nodes.push(p.nodes[0]);expect(()=>parseProject(JSON.stringify(p))).toThrow();const q=seed();q.skills[0].versions.push(q.skills[0].versions[0]);expect(()=>parseProject(JSON.stringify(q))).toThrow();});
});
describe('workflow validation',()=>{
 it('accepts seed with bounded rework and reachable human fallback',()=>expect(validate(seed())).toEqual([]));
 it('reports unbounded cycles',()=>{const p=seed();p.edges[4].data.maxRetries=0;expect(validate(p).some(f=>f.message.includes('无界循环'))).toBe(true);});
 it('requires human fallback for bounded cycles',()=>{const p=seed();p.edges[4].data.fallback='end';expect(validate(p).some(f=>f.message.includes('人工兜底'))).toBe(true);});
 it('reports unreachable nodes and dangling transitions',()=>{const p=seed();p.nodes.push({...p.nodes[0],id:'orphan',data:{...p.nodes[0].data,kind:'end'}});p.edges.push({...p.edges[0],id:'dangling',target:'missing'});const f=validate(p);expect(f.some(f=>f.nodeId==='orphan')).toBe(true);expect(f.some(f=>f.edgeId==='dangling')).toBe(true);});
 it('validates missing roles, skill versions and contract fields',()=>{const p=seed();p.roles[0].input='';p.roles[1].bindings[0].version=99;p.nodes[1].data.roleId='missing';const f=validate(p);expect(f.some(f=>f.message.includes('输入输出'))).toBe(true);expect(f.some(f=>f.message.includes('版本不存在'))).toBe(true);expect(f.some(f=>f.message.includes('有效角色'))).toBe(true);});
});
describe('frozen exports',()=>{
 it('uses bound version even when a new version is available',()=>{const p=seed();p.skills[0].versions.push({version:2,definition:'NEW_ONLY',resources:[]});const human=markdown(p).split('## 冻结的结构化定义')[0];expect(human).toContain('代码实现规范 v1');expect(human).not.toContain('NEW_ONLY');});
 it('exports referenced resources in ZIP with entry and capability requirements',async()=>{const p=seed();p.skills[0].versions[0].resources.push({name:'rules.txt',content:'rules'});expect(needsZip(p)).toBe(true);const zip=await JSZip.loadAsync(await runtimeZip(p));expect(await zip.file('skills/code/v1/0-rules.txt')!.async('string')).toBe('rules');expect(await zip.file('PLUGIN.md')!.async('string')).toContain('宿主必须自行适配');});
 it('keeps HTML and scripts inert as plain text',()=>{const p=seed();p.skills[0].versions[0].definition='<script>throw Error("executed")</script>';expect(parseProject(serialize(p))).toEqual(p);expect(markdown(p)).toContain('<script>');});
});
describe('IndexedDB persistence',()=>{
 it('persists multiple projects, selected project and skill versions',async()=>{const p=seed(),q=seed();q.name='第二个插件';const lib={projects:[p,q],activeId:q.id};await saveLibrary(lib);expect(await loadLibrary()).toEqual(lib);});
 it('rejects invalid writes without replacing saved drafts',async()=>{const p=seed(),lib={projects:[p],activeId:p.id};await saveLibrary(lib);await expect(saveLibrary({...lib,activeId:'missing'})).rejects.toThrow();expect(await loadLibrary()).toEqual(lib);});
});

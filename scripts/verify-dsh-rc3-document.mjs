/** Reuses the native CLI / Session / AgentLoop probe, isolated to the exact rc.3 publication. */
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const modules=process.env.APD_DSH_RC3_NODE_MODULES??'/tmp/apd-dsh-rc3/node_modules';
assert.equal(JSON.parse(readFileSync(join(modules,'@deepseek-ai/dsh/package.json'))).version,'0.2.1-rc.3');
assert.equal(JSON.parse(readFileSync(join(modules,'@deepseek-ai/dsh-tools/package.json'))).version,'0.2.1-rc.3');
const source=process.argv[2]?JSON.parse(readFileSync(process.argv[2])):{fixtures:['mixed-connections','legacy-constraints','beginner-defaults'].map(name=>({name,directory:'deliverables/edge-ui'}))};
for(const fixture of source.fixtures){const zip=await JSZip.loadAsync(readFileSync(resolve(fixture.directory,fixture.name+'-deepseek.zip'))),pkg=JSON.parse(await zip.file('package.json').async('string')),metadata=JSON.parse(await zip.file('document.json').async('string'));assert.equal(pkg.engines.dsh,'0.2.1-rc.3 || 0.2.1-rc.5');assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-tools'],pkg.engines.dsh);assert.deepEqual(metadata.supportedHostVersions,['0.2.1-rc.3','0.2.1-rc.5']);}
const path=join(mkdtempSync(join(tmpdir(),'apd-rc3-probe-')),'config.json');
writeFileSync(path,JSON.stringify({...source,evidencePrefix:'rc3-'+(source.evidencePrefix??'edge-ui-document')}));
const result=spawnSync(process.execPath,[resolve('scripts/verify-document-hosts.mjs'),'deepseek',path],{stdio:'inherit',env:{...process.env,APD_DSH_NODE_MODULES:modules,APD_DSH_BIN:join(modules,'.bin/dsh')}});
assert.equal(result.status,0,'rc.3 native documentation probe failed');

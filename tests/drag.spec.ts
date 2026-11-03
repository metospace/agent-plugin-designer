import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {dragRegression}=require('../scripts/drag-regression.cjs');
test('continuous drag keeps nodes, edge paths and viewport stable; schema, undo and reload preserve endpoints',async({page})=>{
 await page.goto('/');await expect(page.getByText('已保存到本机')).toBeVisible();
 const node=page.locator('.react-flow__node[data-id="qa"]');const initial=await node.getAttribute('style');
 const report=await dragRegression(page,process.env.APD_DRAG_UI_OUT??'deliverables/drag-fixed','browser');
 expect(report.frames).toBeGreaterThan(100);expect(report.blankFrames).toBe(0);expect(report.replacedFrames).toBe(0);expect(report.viewportChanges).toBe(0);expect(report.edgeMissingFrames).toBe(0);
 const r=await node.boundingBox();await page.mouse.move(r!.x+70,r!.y+27);await page.mouse.down();await page.mouse.move(r!.x+112,r!.y+46,{steps:25});await page.mouse.up();
 const final=await node.getAttribute('style');expect(final).not.toBe(initial);await expect(page.getByText('已保存到本机')).toBeVisible();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目文件',exact:true}).click();const file=await wait;const {readFile}=await import('node:fs/promises');const backup=JSON.parse(await readFile((await file.path())!,'utf8'));
 for(const n of backup.nodes)expect(Object.keys(n).sort()).toEqual(['data','id','position','type']);
 await page.getByTitle('撤销 Ctrl+Z').click();expect(await node.getAttribute('style')).not.toBe(final);await page.getByTitle('重做 Ctrl+Shift+Z').click();expect(await node.getAttribute('style')).toBe(final);
 await page.waitForTimeout(700);await page.reload();await expect(page.getByText('已保存到本机')).toBeVisible();expect(await node.getAttribute('style')).toBe(final);await expect(page.locator('.react-flow__edge')).toHaveCount(6);
});

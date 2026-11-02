import {test,expect} from '@playwright/test';
import JSZip from 'jszip';
import {readFile} from 'node:fs/promises';
test('resource import, fixed-version ZIP and plugin rename',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'插件库',exact:true}).click();await page.getByTitle('重命名插件').click();await page.getByLabel('插件名称').fill('质检工作室');await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByTitle('关闭对话框').click();await expect(page.locator('.project-title')).toContainText('质检工作室');
 await page.getByRole('button',{name:/^技能包/}).click();await page.locator('article').filter({hasText:'代码实现规范'}).getByRole('button',{name:'编辑并创建版本'}).click();await page.getByLabel('附带文本资源').setInputFiles({name:'checklist.md',mimeType:'text/markdown',buffer:Buffer.from('安全检查清单')});await page.getByRole('button',{name:'保存技能版本'}).click();
 await page.getByRole('button',{name:'流程设计',exact:true}).click();await page.locator('.react-flow__node').filter({hasText:'开发实现'}).click();await page.locator('.inspector-tabs').getByRole('button',{name:'技能',exact:true}).click();await expect(page.getByLabel('固定版本')).toHaveValue('1');await page.getByLabel('固定版本').selectOption('2');
 await page.getByRole('button',{name:'导出插件',exact:false}).first().click();await expect(page.getByRole('button',{name:/Markdown 插件/})).toBeDisabled();const promise=page.waitForEvent('download');await page.getByRole('button',{name:/完整插件 ZIP/}).click();const download=await promise;const zip=await JSZip.loadAsync(await readFile((await download.path())!));expect(await zip.file('skills/code/v2/0-checklist.md')!.async('string')).toBe('安全检查清单');expect(await zip.file('PLUGIN.md')!.async('string')).toContain('质检工作室');
});

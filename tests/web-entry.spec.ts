import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('web entry points preserve previous drafts and support project round-trip',async({page})=>{
 await page.goto('/');
 const start=page.getByRole('region',{name:'快速开始'});
 await expect(start).toBeVisible();
 await expect(start).toContainText('草稿仅保存在当前浏览器');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await start.getByText('如何使用',{exact:true}).click();
 await expect(start).toContainText('无需拖拽');
 await start.getByRole('button',{name:'空白开始',exact:true}).click();
 await expect(page.locator('.react-flow__node')).toHaveCount(2);
 await page.getByRole('button',{name:'插件库',exact:true}).click();
 await expect(page.locator('.library-list>div')).toHaveCount(2);
 await page.getByTitle('关闭对话框').click();
 await start.getByRole('button',{name:'试用开发质检模板',exact:true}).click();
 await expect(page.locator('.react-flow__node')).toHaveCount(6);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'保存项目文件',exact:true}).click()]);
 const contents=await readFile((await download.path())!,'utf8');
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),start.getByRole('button',{name:'打开项目文件',exact:true}).click()]);
 await chooser.setFiles({name:'backup.agent-project.json',mimeType:'application/json',buffer:Buffer.from(contents)});
 await expect(page.getByRole('status')).toContainText('已导入为独立项目');
 await page.getByRole('button',{name:'插件库',exact:true}).click();
 await expect(page.locator('.library-list>div')).toHaveCount(4);
});

for(const width of [1280,1024,820,768]){
 test(`web workbench fits ${width}px and keeps editing reachable`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/');
  await expect(page.locator('.react-flow__node')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('region',{name:'快速开始'}).getByRole('button',{name:'空白开始',exact:true}).click();
  await page.locator('.node-palette').getByRole('button',{name:'Agent',exact:true}).click();
  await page.getByLabel('节点名称',{exact:true}).fill('网页编辑');
  await page.getByLabel('这一步做什么',{exact:true}).fill('配置流程，不需要安装桌面应用');
  await page.getByTitle('添加连线').click();
  await page.getByLabel('来源节点').selectOption({label:'任务开始'});
  await page.getByLabel('目标节点').selectOption({label:'网页编辑'});
  await page.getByRole('button',{name:'创建连线',exact:true}).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

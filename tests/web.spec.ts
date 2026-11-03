import { test, expect } from '@playwright/test';
test('production web can generate a reviewed draft, undo, download and restore browser data',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://provider.example/v1/chat/completions',async route=>{
  const body=route.request().postDataJSON();expect(body.model).toBe('test');expect(body.messages).toHaveLength(2);expect(JSON.parse(body.messages[1].content).context).toBeUndefined();
  await route.fulfill({contentType:'application/json',body:JSON.stringify({choices:[{message:{content:JSON.stringify({mode:'append',summary:'浏览器测试草案',roles:[{key:'writer',name:'整理员',responsibility:'整理材料'}],nodes:[{key:'work',kind:'agent',label:'Web测试步骤',task:'整理材料',roleKey:'writer'}],edges:[]})}}]})});
 });
 await page.goto('http://127.0.0.1:4175/');await page.getByText('已保存到本机',{exact:true}).waitFor();
 const count=await page.locator('.react-flow__node').count();
 await page.getByRole('button',{name:'AI 辅助设计',exact:true}).click();await page.getByLabel('API 地址',{exact:true}).fill('https://provider.example/v1');await page.getByLabel('模型名称',{exact:true}).fill('test');await page.getByLabel('API Key',{exact:true}).fill('TEST_ONLY_KEY');await page.getByLabel('我确认将本次内容和 Key 直接发送到填写的 API').check();await page.getByLabel('描述你的想法',{exact:true}).fill('增加整理步骤');await page.getByRole('button',{name:'发送并生成草案',exact:true}).click();await expect(page.getByTestId('ai-preview')).toBeVisible();await expect(page.locator('.react-flow__node')).toHaveCount(count);
 await page.getByRole('button',{name:'应用到画布',exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(count+1);await page.getByRole('button',{name:'关闭 AI 面板'}).click();await page.getByTitle('撤销 Ctrl+Z',{exact:true}).click();await expect(page.locator('.react-flow__node')).toHaveCount(count);
 await page.getByText('已保存到本机',{exact:true}).waitFor();await page.reload();await expect(page.locator('.react-flow__node')).toHaveCount(count);
 await page.getByRole('button',{name:'AI 辅助设计',exact:true}).click();await expect(page.getByLabel('API Key',{exact:true})).toHaveValue('');await page.getByRole('button',{name:'关闭 AI 面板'}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目文件',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toMatch(/agent-project.json$/);expect(await file.failure()).toBeNull();expect(errors).toEqual([]);
});
test('web and desktop production CSP remain distinct',async({request})=>{
 const web=await (await request.get('http://127.0.0.1:4175/')).text();const desktop=await (await request.get('http://127.0.0.1:4174/')).text();expect(web).toContain('connect-src https:');expect(desktop).toContain("connect-src 'none'");expect(web).not.toContain('unsafe-eval');
});

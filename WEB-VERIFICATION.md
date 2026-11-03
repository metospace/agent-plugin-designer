# Web 改造验证记录

基线：af8dcea929ea290f33e9cb0dc34f3cb758d19de5。未推送、未部署、未调用真实收费 API。

## 已通过

- Web 生产构建（TypeScript + Vite + Web CSP）。
- 桌面前端生产构建（保留 connect-src 'none'）。这不等同 Windows 原生 EXE 验收。
- 最新前端/模型/导出/AI 单元测试通过；最终数量见本包 FOLLOWUP-RESULTS.md。
- 最新运行器与评测器测试通过，包括步骤描述/交付、预算/取消/恢复、兼容与客观判分；最终数量见 FOLLOWUP-RESULTS.md。
- HTTP 读取两个产物的 CSP 差异检查。
- git diff --check。
- Python 启动脚本通过编译及 HTTP 冒烟：主页与构建产物逐字一致，源码路径返回 404。

## 已添加但浏览器执行受环境阻挡

Playwright 全套 31 个用例中，1 个无需浏览器的 CSP 检查通过；其余 30 个在浏览器启动阶段被环境的进程 socket 权限限制阻断，未执行页面交互。不能视为这些场景已验收，也不能据此认定功能失败。

新增用例涵盖：独立空白/模板/导入入口与 JSON 回导，1280/1024/820/768px 窗口编辑，Web 生产版模拟 AI 预览/应用/撤销，关闭清除 Key，刷新持久化，项目下载。现有测试继续覆盖技能版本、自然语言流程、宿主导出、拖动、撤销重做和 AI 取消/重复点击/过期预览。

Cloud Browser 与执行容器的本机地址不可互通，也未能替代完整 UI 测试。没有声称完成视觉验收、真实供应商 CORS 验收、Windows 原生回归或移动触控验收。

## 在可启动 Chromium 的机器补验

```sh
npm ci
npm run build:web
npm run build
npm test
npm run test:e2e
```

Linux 默认使用 /usr/bin/chromium；可用环境变量 PLAYWRIGHT_CHROMIUM_EXECUTABLE 指定已安装的 Chromium 路径。其他平台需要本机 Playwright Chromium（可运行 `npx playwright install chromium`）。

测试仅应使用本地模拟响应，不填真实密钥。测试完后查看 Playwright 输出，不能沿用本目录历史交付报告当作本次结果。

## 第二轮改进的验收范围

新增运行器与评测回归已执行，不代表真实宿主或真实模型质量通过。当前 Codex CLI 版本为 0.166.0-alpha.1，生产适配器仍只承认已经锁定的 0.159.0-alpha.3；新版本的真实兼容性探测在本机 app-server 初始化阶段因只读文件系统失败，无 thread/model 事件。默认及扩展执行结果一致。未放宽版本门禁、复制凭据或改安全配置。

固定合成评测包含单节点受控基线、文档上下文、两独立会话工作流三组，每次最多12次派发，逐项严格JSON客观判分。此处只通过评测器的脚本自测，没有可报告的真实模型准确率。详细证据：evaluation/README.md 和 deliverables/evaluation/*.json。

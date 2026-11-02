# Agent Studio · Windows Agent 团队插件设计器

独立的中文桌面 Web 应用。React + TypeScript + Vite + React Flow。无账号、后端、LLM API、运行引擎、云同步或付费服务。所有字体与图标随浏览器或构建提供，不请求外部资源。

## Windows 应用

目标平台为 Windows 10/11 x64。Electron 桌面窗口直接打开本地界面；安装后不需要 Python、Node、终端或浏览器服务器。应用完全本地运行。

仓库的 GitHub Actions 会在推送 main 后生成 Windows 安装版与便携版：

1. 打开仓库的 **Actions → Build Windows app**。
2. 打开最近一次成功的运行，下载 **Agent-Studio-Windows-x64** artifact。
3. 解压后运行 `Agent-Studio-1.0.0-x64-nsis.exe` 安装，或运行文件名含 `portable` 的便携版。

当前构建没有代码签名。若系统显示发行者未知，请结合本仓库源码和构建来源决定是否运行。本轮 Linux 环境已验证前端构建与浏览器功能；实际 Windows EXE 构建、启动与重启持久化检查由上述 Windows CI 执行，成功前不能认为已完成 Windows 验收。

Windows 草稿保存于 `%APPDATA%/AgentPluginDesigner/` 的 IndexedDB。便携版也使用这个用户数据目录，不将草稿放在 EXE 旁。清理应用数据会丢失草稿，必须定期导出项目 JSON；浏览器旧草稿需要导出后导入桌面版。

开发 Windows 应用：

```sh
npm ci
npm run desktop
npm run dist:win
```

`npm run dist:win` 在 Windows 上生成 `release/` 下的 NSIS 安装包和 portable 便携 EXE。工作流还会启动打包后的程序两次，检查界面、沙盒和 IndexedDB 跨进程恢复；`npm run test:desktop` 可重跑这项检查。桌面窗口不向渲染页面开放 Node 或文件系统 API，仅提供内置页面与系统导出对话框。

## 不安装 Node 的预览方式

使用交付的 `agent-plugin-designer-preview.zip`，解压后运行 `preview.py`（需要 Python 3，无第三方依赖），浏览器打开 http://127.0.0.1:8765/app.html 。只监听本机，不部署到服务器。保持该终端运行；Ctrl+C 停止。

也可尝试直接双击 `app.html`；当前受管环境禁止 `file://`，此方式未在本环境验证，不同浏览器对本地文件的 IndexedDB 策略可能不同。推荐固定地址的本地 HTTP 方式。切换端口、浏览器或地址会形成不同的本地存储空间，迁移请使用项目导出／导入。

## 使用

- 顶部插件名称打开插件库，可新建、重命名、复制或删除插件。
- Agent 配置中定义职责、输入输出及独立会话要求。技能包支持文本定义导入、版本保留和文本资源。
- 点击左侧组件／角色添加节点。拖动节点；从连接点拖出连线。选中右侧编辑节点、技能绑定、交接条件或返工规则。
- 编辑技能生成新版本；既有角色绑定保持旧版本。右侧技能页可手动选择版本、设置使用条件及能力要求。
- Ctrl/⌘+Z 撤销，Ctrl/⌘+Shift+Z 重做，Delete/Backspace 删除节点或连线，Esc 取消选择。输入框编辑不触发画布快捷键。
- 检查流程发现缺失字段、失效角色／技能、不可达节点、悬空连线和无界循环。点击结果定位节点。
- 项目 JSON 是完整可编辑备份，保留技能历史、布局和规则；导入创建独立副本，不覆盖当前项目。
- Markdown/ZIP 是运行插件约定。资源型技能需 ZIP；ZIP 包含 PLUGIN.md 与固定版本文本资源。宿主必须自行适配与授权，不能宣称任意 harness 可直接安装。

## 数据

IndexedDB 数据库 `agent-plugin-designer`，对象仓库 `workspace`，键 `current`。每次编辑后约 250 ms 自动保存，顶部明确显示状态。请在显示「已保存到本机」后关闭页面，并定期保存项目文件。清理网站数据、无痕窗口退出会丢失草稿；不提供云同步。读取失败时不会初始化并覆盖已有数据。

导入严格校验 schemaVersion=1、结构、类型、数量、唯一 ID 和资源路径。10 MB 项目文件上限；单个技能／资源文本 100 KB。仅支持 txt/md/json/csv 文本资源，不自动执行代码或 Markdown HTML。不要在技能中保存密钥。

## 开发与验证

```sh
npm ci
npm run dev
npm run build
npm test
npm run test:e2e
```

端到端配置默认使用环境的 `/usr/bin/chromium`；其他机器可在 `playwright.config.ts` 修改 executablePath。生产构建在 `dist/index.html`，所有脚本样式已内联。详细结果见 `design-qa.md` 与 `deliverables/browser-results.json`。

## 当前边界

面向桌面 1280px 及以上；移动端不在本次范围。无多人／多标签冲突合并，无任意二进制技能资源，无执行引擎。流程检查是结构检查，不证明自然语言条件互斥或完备。撤销历史保留当前会话最近 100 次变更，切换项目后清空；删除插件不可撤销，必须确认。

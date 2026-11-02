# Agent Studio · Windows Agent 团队插件设计器

独立的中文桌面 Web 应用。React + TypeScript + Vite + React Flow。无账号、后端、LLM API、运行引擎、云同步或付费服务。所有字体与图标随浏览器或构建提供，不请求外部资源。

## Windows 应用

目标平台为 Windows 10/11 x64。MyGo 使用系统 WebView2 展示原有界面；包内不再包含 Electron、Chromium、Node 或浏览器服务器。Windows 11 通常已有 WebView2；Windows 10 若没有运行时，需要单独安装微软 WebView2 Runtime。运行时的下载与磁盘占用不计入应用包体积。

仓库 Actions → **Build Windows app** 在 main 推送后构建，仅上传 artifact，不创建 Release。下载成功运行中的 **Agent-Studio-MyGo-Windows-x64**：

- `Agent-Studio-1.2.0-Windows-x64-Setup.exe`：当前用户安装版。
- `Agent-Studio-1.2.0-Windows-x64-Portable.exe` / `.zip`：便携可执行文件，无需安装。
- `SHA256SUMS.txt`：下载文件校验。

当前构建没有代码签名。系统可能显示发行者未知，请结合仓库源码、构建来源与校验值决定是否运行。**Agent-Studio-MyGo-Verification** 保存真实 Windows 启动、连续拖拽、原生保存／取消／导入对话框、插件 Markdown、进程重启和布局恢复的测试结果、截图，以及同一 CI 上测量的旧／新文件体积。请以该运行最终状态为准。

MyGo 固定为 [`928c867c717d84cd26e409cd3ae23fbee7637c43`](https://github.com/egoist/mygo/tree/928c867c717d84cd26e409cd3ae23fbee7637c43)，Go 模块与 CLI 使用同一个精确版本；要求 Go 1.27.3。API 与构建方式依据该版本官方源码和文档，未使用浮动 `latest`。

**从旧版迁移：** 先在旧 Electron 版点击「保存项目文件」，再在 MyGo 版点击「导入项目」。旧版 `%APPDATA%/AgentPluginDesigner/` 与 `studio://app` 的 IndexedDB 保持原样；新版 `%APPDATA%/Agent Studio/` 的 WebView2 使用 `http://mygo.localhost`。两个存储空间不会自动合并。请保留旧程序与项目备份，验证导入后再自行处理旧版。便携版与安装版共用新版用户目录；便携不表示草稿在 EXE 旁。

开发桌面版（Node 24 + Go 1.27.3；不需要 Bun）：

```sh
npm ci
npm run desktop
npm run dist:win
```

`mygo.json` 使用 JSON 配置；CLI 嵌入前端并创建 NSIS 安装包。`npm run test:desktop` 需在 Windows 上执行；通过 WebView2 标准调试环境变量临时连接发布二进制，测试本身未嵌入应用，也未打包自动化插件。发布程序没有开放的调试端口，只有测试进程显式设置该变量时启用。导出经唯一的保存服务显示原生对话框，只写用户选择的文件，支持 JSON／Markdown／ZIP，单次导出上限 50 MB；页面不绑定任意路径读写或 shell 服务，拒绝权限与新窗口请求，并保留禁止外网的生产 CSP。

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

面向桌面 1280px 及以上；移动端不在本次范围。无多人／多标签冲突合并，无任意二进制技能资源。设计器本身不运行 Agent；可安装导出包含限定模板的宿主执行适配器。流程检查是结构检查，不证明自然语言条件互斥或完备。撤销历史保留当前会话最近 100 次变更，切换项目后清空；删除插件不可撤销，必须确认。

## 拖动修复与验证

画布现在保留 React Flow 的完整临时节点状态（尺寸、选择、拖动标记）；拖动过程中不重建项目库，结束时仅把位置写入 schemaVersion=1，并产生一次撤销记录。节点与边保留 DOM 身份，视口不因拖动重置，测量状态不会混入项目备份或自动保存。

本地旧实现复现：连续 12 次拖动采样 595 帧，282 帧存在隐藏节点，585 帧缺少边路径，并最终触发严格 schema 保存失败。修复后的连续拖动与回归结果见 `deliverables/drag-fixed/`；原有 13 个模型测试与 4 个端到端场景保留，新增持续拖动、保存／导出、撤销重做及刷新布局恢复场景。

通用 Markdown/ZIP 仍是流程说明。新增「宿主可安装 ZIP」使用独立的可执行 contract v2；其有限状态谓词、候选 SHA256／原始验收标准绑定、恰好 3 次返工与人工风险接受已实现。详情见 [HARNESS.md](HARNESS.md)。


## Codex 与 DeepSeek Harness 可安装导出

在「导出插件」选择执行宿主，再点「宿主可安装 ZIP」。支持 Codex 0.159.0-alpha.3（原生技能插件 + CLI 执行适配器）与 DeepSeek Harness 0.2.1-rc.5（原生 Cordis 工具／人工命令 bundle），Node >=24.9.0。二者共用冻结来源、确定性运行状态和完整项目备份。完整安装／选择／移除、权限与证据分类见 [HARNESS.md](HARNESS.md)。

# 1.4.0 联合反馈与 AI 主交付验证

普通连线不再要求流转条件或交接：普通来源按完成后继续，条件来源才设置分支／默认分支，并行来源自动分发。可选连接说明独立保存；旧 condition 原文可见，说明书保留原有流转要求。角色基本表单仅名称与职责，节点只写这一步做什么／选负责人；无详细输入输出时默认承接所有实际到达的上游结果并交付步骤结果。旧高阶配置优先保留，多上游列全，不等待未触发分支。

新增可选 AI 辅助：用户配置地址、模型与会话 Key，描述想法→严格草案预览→确认应用→单步撤销。默认仅发本次描述，共享选中节点／整个流程须逐次确认；不自动附带历史。Key 不持久化、不进入项目／Markdown／ZIP／日志。仅支持非流式 Chat Completions 文本协议，不宣称真实供应商质量；测试没有真实凭据或付费调用。

74 项主测试通过（23 model、11 harness、11 AI、29 runtime），Go AI 8 组 std-only 测试及本地 race 通过，最终 21 项浏览器测试全通过。浏览器 AI 为明确分类的模拟 bridge，覆盖应用前不改图、单步撤销、create/append/selected、取消迟到、预览冲突、每次共享确认、401/429/超时/网络、未知字段／悬空引用／规模／工具调用／双击／Key 导出与存储检查，不等同原生网络。

`deliverables/edge-ui/` 三套真正 UI 创建的连接／旧约束／初心者项目包含 3 JSON、3 MD、6 原生 ZIP，12 项文件 SHA256 均对齐 manifest。真实 Codex、DSH rc.3、DSH rc.5 都分别同时安装三个包，实际原生技能／工具返回所选完整 Markdown，并验证另外两份全文未载入；用本地脚本提供器，没有外部模型。新证据保存为 `*edge*document*.json`，未覆盖历史包。

DSH Desktop 与独立 CLI profile 不互通；README/HARNESS 已提供准确 rc.3 官方 tag 核实的 Windows 内置 dsh.cmd 命令、desktop profile、初启／退出／重开步骤。打包 Desktop UI 未实测，文档读取不等于任务完成。

1.4.0 本次 Windows CI **待发布后验证**。保留原全部 native 保存／取消／导入／持续拖动／两项目重启及 MD／双文档包／显式高级断言；新增基本表单真初心者流程和导入后四项目重启、实际 Go bridge→同机 HTTP mock 的成功／撤销／401／429／工具拒绝／真实取消／原生导出无 Key。只从纯文字日志／JSON验收；自动截图仅存 artifact，既不打印 base64，也不读取任何图片，不声称本轮视觉验收。

以下为历史记录，不能替代 1.4.0 的当前接口、DSH 兼容范围或 Windows 本次验收。

---

# 1.3.0 流程说明书历史验证

52 项测试通过（23 项模型／导出 + 29 项运行时回归），9 项真实浏览器测试通过，并单独加强资源保留验证。默认导出是可由大模型阅读使用的流程说明书，用户可自由配置节点、自然语言分支与草稿，不要求程序谓词或运行器。

通过真实 UI 创建三份不同图：自然语言多分支、并行与人工、包含自回路／双边／孤立节点的草稿。各自绑定角色、技能 v1/v2 与文本资源；DOM 预览、独立 Markdown、包内 WORKFLOW.md 逐字一致。`deliverables/document-ui/` 包含 3 MD、3项目JSON、6原生ZIP、3截图，15项文件均有 `export-evidence.json` SHA256。

真实 Codex 与 DSH 各同时安装／发现／移除三个文档插件，并逐个明确选择完整正文：Codex 原生技能的实际本地模型请求包含所选全部 Markdown；DSH 实际 Cordis／Session／AgentLoop 的只读工具返回全文，并完整进入后续模型消息。两者都验证另两份全文未载入。证据 `deliverables/harness/*document*.json` 直接匹配上述最终 UI manifest。默认文档包没有任务运行器、子 Agent 或额外授权要求。

以上使用本地脚本提供器，没有外部模型或付费调用。原生入口与全文加载是真的；模型能否理解并遵循说明书、能否完成实际任务未由此证明，文档也不强制调度。

## 可选高级执行回归

`deliverables/general-ui/` 的三份可执行图与六ZIP在本次完整浏览器套件重建后，已重新执行两宿主各9场景、各18独立子会话及实际安装测试；当前 `*general*.json` 来源哈希与当前六包一致。覆盖顺序、默认路由、有界循环、人工继续／取消、乱序并行汇合、损坏输出、实际中断与幂等恢复。Codex人工路径调用真实导出scripts/human.mjs的PTY并验证非TTY拒绝；DSH使用实际用户命令边界，输入均为脚本化测试而非实际用户决定。

DSH 实际写入工具探针被只读guard拒绝、文件未产生。Codex 实际 exec_command 写入探针在shell前被环境阻断：`error building bubblewrap command: app-server socket directory must be a user-owned directory with mode 0700`。文件未产生，但不能据此证明本环境的文件系统只读强制；此限制只属于可选执行测试，不影响默认文档全文加载。

1.3.0 本次 Windows CI **待发布后验证**，不能以历史成功替代。原生套件保留便携／安装启动、拖动、保存／取消／导入及两项目重启；默认文档包比较全文MD／源项目，高级执行包另显式选择。Verification artifact包含Windows结果、document-ui、general-ui及两类宿主JSON。

以下为先前阶段历史记录；其中36 tests、contract v2、固定返工次数和旧Windows结果不代表当前默认文档范围。

---

# 历史宿主适配验证（contract v2）

36 项单元／确定性合同测试、两种可安装导出与原项目往返；实际 Codex CLI 和 DeepSeek Session/AgentLoop 使用本地脚本提供器验证，不是外部模型效果评测。Windows 原生套件新增两种宿主 ZIP 的真实保存、清单与完整来源比较。原 MyGo 与拖动修复测试保留。详见 HARNESS.md 与 deliverables/harness。

以下为先前阶段的历史验证记录，旧范围限制不覆盖新增的宿主适配。

# MyGo 迁移验证补充（2026-11-02）

封装已从 Electron 迁移至固定 MyGo commit 928c867c717d84cd26e409cd3ae23fbee7637c43（Go 1.27.3），保持原有 UI、schemaVersion=1、项目与技能导入导出；旧 Electron 数据目录不删除，迁移采用显式导出／导入。

原 React Flow 忽略尺寸变更并在每帧创建缺少 measured 的节点对象，导致节点／边重复初始化；持续拖动又将 dragging 标记传入严格存储 schema，导致保存和导出失败。现在画布完整保留临时视图状态，拖动结束才提交纯位置，保存与撤销各一次。

旧版本 12 次连续拖动的 595 个 rAF 采样中，282 帧隐藏节点，585 帧缺失边路径。`deliverables/drag-baseline/` 留存统计与截图；截图采样时图形恢复正常，不能单凭这些截图证明空白帧。修复后本地 rAF 采样零隐藏／替换／视口跳变／缺边；`deliverables/drag-fixed/` 保存截图和统计。13 个单元测试、原 4 个端到端测试及新增拖拽回归均通过。Windows 发布二进制验收以该 commit 的 Actions 最终结果及 Verification artifact 为准；本地交叉编译不代替 Windows 运行证据。

Windows CI 对便携与安装后二进制分别执行真实启动、持续拖动、原生保存／取消／导入对话框、Markdown 导出、重启恢复及项目节点连线精确比较。CI 从旧 Electron 成功运行下载原始 artifact 后逐个测量旧 EXE，并记录新 EXE／安装包／ZIP 长度与签名状态。外部系统 WebView2 不计入包体积，发布程序未签名。CI 只产出 artifact，不发布 Release。

后续宿主适配已新增：限定模板的可执行 contract v2、候选 SHA256／原始验收标准绑定、恰好 3 次返工与人工风险接受分离。通用 Markdown 保留原语义；安装导出与实际宿主证据见 HARNESS.md。

---
以下为第一版历史验证记录，其 Electron 描述仅适用于旧版：

# Agent Studio 验收记录

日期：2026-11-02。独立工作区：`/workspace/agent-plugin-designer`。

## 结论

可运行的第一版设计器已完成。最终 TypeScript / Vite 构建成功；13 项单元测试、4 组真实 Chromium 浏览器测试通过。并非 harness 安装器或执行引擎。未修改 jz-harness 或 Chat3D，未提交、推送、发布或安装任何真实插件。

## 已验证

| 范围 | 证据 / 结果 |
|---|---|
| 构建 | `npm run build` 通过；`dist/index.html` 单文件内联构建，约 650 KB |
| 核心测试 | `npm test`，13/13 通过：结构化格式、往返、非法格式/版本/ID、重复标识、有限返工、无界循环、人工兜底、不可达/悬空节点、缺失角色/技能、版本冻结、ZIP、纯文本安全和 IndexedDB |
| 浏览器主流程 | 创建角色 → 创建技能 → 发布 v2 → 绑定版本与条件 → 刷新恢复 → 检查 → MD 导出 → 项目导出/导入 → 再刷新 |
| 画布 | 新建空白插件；真实拖动连接点创建连线；编辑条件/交接；拖动节点；验证结果定位缺失角色的节点 |
| 撤销与重复操作 | 删除节点、撤销、重做、再撤销；删除角色取消/确认/撤销；复制插件、删除取消与再次确认 |
| 资源和版本 | 导入文本资源发布 v2；原绑定保持 v1；显式升级后，MD 按钮禁用，ZIP 包含对应 v2 资源与入口 |
| 项目名称 | 插件重命名后出现在导出入口中 |
| 无效导入 | 损坏 JSON 被拒绝，当前节点数量未变，项目不被覆盖 |
| 生产版本 | 单文件成品通过本地 Python 静态 HTTP 服务在 Chromium 成功加载，IndexedDB 保存正常 |
| 1440×1000 与 1280×900 | 最终截图已实际查看；三栏无重叠，无横向溢出；左侧文字不再竖向断行，隐藏上传控件不再占据页面 |
| 错误检查 | 主流程 pageerror 为空；文本 HTML 不作为 HTML 渲染 |

浏览器测试源：`tests/app.spec.ts`、`tests/resources.spec.ts`。最终机器可读结果：`deliverables/browser-results.json`。单元测试源：`src/model.test.ts`。截图：`deliverables/workflow-1440.png`、`deliverables/workflow-1280.png`。

## 明确阻塞 / 未验证

1. **参考图下载失败，未查看原图。** 目标 Library ID：`libfile_a0b433b5aea08191a1045998bdbdc767`，文件 `exec-345ba064-8f56-45aa-9174-3fe63b435e2c.png`。通过当前 Library 的 prepare_materialize 与配套文件传输流程尝试两次，均返回 `library file transfer failed: download failed`，本地 reference 目录为空。结果：失败，不是成功或待批准。没有绕过访问路径。继续实现依据为任务提供的白/靛蓝三栏、标签与功能文字规格。**不得宣称与原图逐像素一致；同尺寸原图对照未完成。**
2. **直接双击 HTML 未验证。** Chromium 访问 `file:///workspace/agent-plugin-designer/dist/index.html` 被环境策略拒绝，`net::ERR_BLOCKED_BY_ADMINISTRATOR`。没有更改策略或重试该操作。成品改由授权的本机 HTTP 静态预览验证；这不表示 file 协议已获验证。
3. Playwright 自带浏览器下载返回 403 Domain forbidden；使用环境预装 `/usr/bin/chromium` 完成所有浏览器测试，没有下载替代来源或改变网络限制。

## 设计修复记录

实际截图检查后修复：隐藏上传元素被 display 规则覆盖、组件中文标签过度换行、1280 宽度保存状态被隐藏、返工连线与主路径重叠、缩略图覆盖交付节点。当前保留适配画布、缩放、撤销/重做和明确的文字提示。弹窗包含焦点约束、Esc 关闭及返回焦点。

## 产品边界

- 只做设计和导出；宿主必须适配会话隔离、条件分支、返工计数与人工暂停。技能能力声明不是授权。
- 技能资源限定为文本（txt/md/json/csv），不执行脚本，不支持任意二进制资源。
- IndexedDB 本地自动保存；无云同步、多标签并发合并或协作服务。清理网站数据会删除草稿。项目 JSON 是完整备份。
- 自动保存有约 250 ms 防抖；关闭前等待保存完成。存储受浏览器配额/隐私设置限制，失败状态可见。
- 桌面 1280px 及以上。移动端、Safari/Firefox 和真实 harness 集成未在本轮验证。
- 结构检查不证明自然语言条件互斥、可执行或逻辑正确。

## 无 Node 预览

解压预览 ZIP，使用 Python 3 运行 `preview.py`，只监听 `127.0.0.1:8765`，浏览器打开 `/app.html`。无需安装 npm 包、Node 或启动业务后端。可选直接双击 HTML，但该路径在本环境被策略阻止，浏览器持久化兼容性未验证。

## Library 交付状态

尝试按当前 Library 技能的 prepared upload 批处理保存源码 ZIP、预览 ZIP、单文件 HTML、验收报告及两张截图。配套 helper 在 `hosted apps tools/list` 阶段失败，返回 `library upload failed: hosted apps tools/list request failed: network`。结果为失败；没有成功创建、替换或 finalize 的返回证据，没有输出 Library ID 或版本。未切换至另一写入路径或重复创建。全部交付文件留在 `/workspace/agent-plugin-designer/deliverables/`。此项是环境网络阻塞，不是用户拒绝或待用户批准。

## Windows 桌面版补充

新增 Electron 桌面入口、NSIS/portable x64 打包配置、Windows GitHub Actions 和打包后双启动持久化测试。前端构建与 13 项单元测试通过。Windows EXE 尚未在本环境生成或运行；工作流未成功前不能把桌面验证标为通过。主进程使用固定内置页面、标准安全自定义协议、脚本哈希 CSP、进程沙盒与上下文隔离；禁用 Node 集成、新窗口、外部导航及权限请求。桌面数据目录为 `%APPDATA%/AgentPluginDesigner`。

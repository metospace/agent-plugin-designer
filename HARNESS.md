# 可安装的宿主工作流

支持 **Codex 0.159.0-alpha.3** 与 **DeepSeek Harness 0.2.1-rc.5**，Node >=24.9.0。选择「导出插件 → 执行宿主 → 宿主可安装 ZIP」。设计器仍负责编辑；任务执行发生在宿主内。宿主执行证据来自 Linux；Windows 原生应用导出两种 ZIP 的验证与 Windows 宿主执行是独立事项。Windows／WSL 宿主执行尚未验证。Windows Codex 如使用本适配器，需要用户启动环境的 APD_CODEX_BIN 指向原生 codex.exe；禁止以 shell:true 执行 npm .cmd/.bat shim。

Codex 输出是原生插件（`.codex-plugin/plugin.json`、显式调用技能、独立 marketplace）加最小 CLI 执行适配器。DeepSeek 输出是原生 Cordis npm bundle（`package.json` 的 `dsh.bundle`、patch、工具与用户命令）。均无安装脚本、后台服务或权限授予。不是把 Markdown 称作可执行插件。

## 安装、选择与移除

解压到固定目录，按包内 `INSTALL.md` 操作。每个包名包含完整项目 ID 与版本的 SHA256 摘要，两个插件与同项目不同版本可以共存，不覆盖名称／工具／命令。修改冻结源码应发布新版本。

Codex：

```
codex plugin marketplace add /absolute/path/to/extracted-bundle
codex plugin add <plugin-id>@<plugin-id>-market
codex plugin list
```

任务显式选择该插件并调用 `$<plugin-id>:<plugin-id>`。禁止隐式自动调用。技能指导主 Agent 调用包内 `node scripts/codex.mjs bundle.json input.json`；适配器用真实 `codex exec --json` 创建新线程，消费 `thread.started`／`turn.completed`，不接受模型提供的会话 ID。

**独立 CLI 无法推断主会话的临时权限覆盖。** 用户必须在启动主 Codex 前，在自己的启动环境设置 `APD_CODEX_DEVELOPER_SANDBOX=workspace-write` 来允许所选工作区开发写入，或设置 `read-only` 用于只读任务。缺失或其他值直接阻塞。模型／任务 JSON 不得设置该授权。QA 固定 `--sandbox read-only`；无绕过审批参数。有效策略写入 dispatch 证据。

移除：`codex plugin remove <plugin-id>@<plugin-id>-market`。

DeepSeek：

```
dsh plugin --profile workflow add /absolute/path/to/extracted-bundle
dsh --profile workflow --dump-config
dsh --profile workflow
```

任务中选择唯一的 `<plugin_id_with_underscores>_run` 工具，传入 `input` JSON 字符串。工具使用真实 `ctx.subagents.startActivation`、原生 `spawn` 提供器、独立上下文、结构化结果和 `childId`；缺失服务会阻止加载，缺失独立提供器／结构化能力会产生 `blocked`。子执行保持宿主原生权限；QA 修改候选会使检查失效。移除：`dsh plugin --profile workflow remove <plugin-id>`。

## 合同、可恢复状态与人工决策

可执行导出只接受明确模板：开始 → 开发角色 → 独立 QA → 条件；通过交付，失败返工，返工上限 3 次后人工。拓扑、角色、独立 QA、返工上限检查不通过就拒绝可执行导出；任意其他图仍可保存为原始项目和通用说明。导出框展示限制与能力检查。运行时使用图中绑定的角色和绑定的冻结技能版本，资源仅为数据。连线条件文字仅为说明；可执行路由使用固定枚举谓词 QA_PASSED_BOUND、QA_FAILED_REWORK_LT_3、QA_FAILED_REWORK_EQ_3，并绑定实际分支 edgeId／fallbackNodeId；不求值自然语言或任意表达式。

```
{
  "taskId": "unique-task",
  "task": "原始需求",
  "criteria": ["原始验收标准"],
  "mainSession": "真实主会话 ID（DeepSeek 由宿主填入）",
  "workspace": "/absolute/task/workspace",
  "statePath": "/absolute/task/workspace/.apd/task.json"
}
```

确定性谓词：全部原始标准逐项有通过证据、独立 QA 会话、原始标准哈希及精确候选 SHA256 都匹配才 `passed`。QA `failed` 且返工数 <3 就增加返工数并回开发；初始实现加恰好三次返工，第四份失败 QA 转 `human_paused`。损坏、未完成、中断、陈旧输出都不能成功。

适配器按文件内容计算候选 SHA256；排除 `.git`、`node_modules` 与 `.apd`，拒绝候选符号链接。QA 前后比较，候选变化立即清除 QA；已通过任务下次恢复时若候选变化也重新检查。测试输出应放 `.apd`，避免改变受检候选。

状态持久化含插件／版本／bundle 哈希、原始任务／标准、候选、真实子会话、事件 ID、返工计数和结果。事件幂等，写入先备份再原子重命名；任务注册表以主会话和任务 ID 固定唯一插件及状态路径，防止换路径混用插件。进程锁防并发；崩溃后先检查记录的宿主子会话再手动移除残留锁，显式 `retry_dispatch` 才能重新派发。运行中的中断状态恢复为阻塞，不假定完成。状态及注册表属于可信本地数据；不是抵抗拥有本机文件修改权限者的安全边界。

人工节点真正暂停。DeepSeek 用户直接调用 `/<plugin-id>-decide`，JSON `{statePath,outcome,reason}`，原生命令注册表绕过模型并核验任务所属会话。Codex 用户在交互终端运行 `node scripts/human.mjs bundle.json state.json`；非交互调用被拒绝。工作流工具不接受人工结果。人工决策依赖宿主用户命令／终端的信任边界，不宣称密码学身份认证。

终态仅 `passed`、`accepted_with_risk`、`failed`、`cancelled`。人工不能制造 `passed`；接受风险仍保留失败 QA。`blocked`、运行中和人工暂停都不是成功。

编辑项目继续使用严格 schema 1；执行合同 schema 2 是单独导出，不就地改写用户导入数据。包内 `project.agent-project.json` 保留完整技能历史、布局和元数据，状态更新保留 `.backup`。不需要破坏性 schema 迁移。

## 验证证据

- `npm test`：17 个模型／打包测试，19 个纯确定性 reducer／adapter 测试。后者明确使用模拟宿主，不代表实际 Agent 运行。
- `scripts/verify-host-install.mjs`：实际 Codex 与 DSH 二进制、隔离配置，安装／列出两个插件／移除；`deliverables/harness/real-host-install.json`。
- `scripts/verify-codex-host.mjs`：实际 Codex 二进制与真实独立线程，使用仅监听 localhost 的脚本 Responses 提供器。还逐个显式选择两个已安装的 namespaced 技能，核对每个模型请求只加载所选技能正文。通过、失败返工通过、耗尽暂停、损坏输出阻塞、幂等恢复；证据 `codex-real-host.json`。脚本输出不是模型能力评测。
- DeepSeek 实际 Session、AgentLoop、spawn 子会话和本地脚本 LlmAdapter 的证据单独保存，区别于模拟 ctx 的 API 测试。
- Windows 套件保留持续拖动、原生保存／取消／导入、两项目重启全量比较，并新增 Codex／DeepSeek 两个 ZIP 的原生保存、入口清单、合同及原始项目全量比较。
- **未调用外部模型，也未进行付费调用。** 实际模型生成代码和实际模型 QA 的质量未由脚本提供器验证。

官方依据：

- [OpenAI 插件格式](https://developers.openai.com/plugins/build/plugins)、[Codex 插件](https://developers.openai.com/codex/plugins)、[非交互模式](https://developers.openai.com/codex/noninteractive/)；实际安装 CLI 的 `--help`、`plugin add/list/remove` 和 `exec --json --output-schema` 已核验。
- [DeepSeek 官方源码](https://github.com/deepseek-ai/deepseek-harness)、[插件打包安装](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)、[子会话](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subagent.md)。研究 master 为 `ce7073d51254c26cd63b22a60835b8f948deb447`（0.2.2-alpha.2）；**支持版本以实际 npm 安装 0.2.1-rc.5 为准**，已按其发布 `.d.ts`／代码验证 `startActivation`、结构化结果、注入和人类命令，未直接假定 master API 兼容。

复现本地 DSH 原生运行：先在隔离目录安装 `@deepseek-ai/dsh@0.2.1-rc.5`，把 `scripts/verify-deepseek-host.mjs` 复制到该目录执行，设置 `APD_HOST_FIXTURES` 指向测试生成的两个 bundle，`APD_EVIDENCE_DIR` 指向证据目录。此测试使用原生 AgentLoop／spawn 与本地脚本提供器，禁止 fetch 外网；不等同完整 CLI 对话或实际模型质量评测。

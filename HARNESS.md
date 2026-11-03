# 流程说明书与可选宿主执行

支持 **Codex 0.159.0-alpha.3** 与 **DeepSeek Harness 0.2.1-rc.5**。默认选择「导出插件 → 流程说明书插件 → 宿主可安装 ZIP」。用户自由配置节点与连线，大模型阅读并使用完整说明书；默认模式不运行任务，不强制调度。宿主安装与全文加载证据来自 Linux；Windows 原生应用导出 ZIP 与 Windows 宿主执行是独立事项。Windows／WSL 宿主尚未验证；只有高级 Codex CLI 适配器才要求 Windows 启动环境的 APD_CODEX_BIN 指向原生 codex.exe，禁止 shell:true 的 npm shim。

默认 Codex 输出是原生插件（`.codex-plugin/plugin.json`、显式调用技能、独立 marketplace）；技能正文内嵌完整说明书。默认 DeepSeek 输出是原生 Cordis bundle（`package.json` 的 `dsh.bundle`、patch 与只读文档工具），工具仅返回说明书全文。均无任务运行器、子会话依赖、安装脚本、后台服务或权限授予。

## 默认：流程说明书插件

`WORKFLOW.md` 与独立 Markdown 下载逐字一致，包含所有节点、连线、自然语言条件、技能固定版本与文本资源内容。`project.agent-project.json` 是完整可编辑来源；`document.json` 标记 `mode:documentation`、目标宿主、真实 pluginId／toolName 与非阻断提醒。内容摘要参与原生包名，不同来源／内容可以共存。草稿、未结构化分支与不完整流程仍能导出；提醒仅帮助作者完善说明。

Codex 解压后执行 `codex plugin marketplace add <目录>`、`codex plugin add <pluginId>@<pluginId>-market`，任务中明确选择 `$<pluginId>:<pluginId>`。原生技能直接加载完整说明书，不运行 Node 脚本，不要求 `APD_CODEX_DEVELOPER_SANDBOX`。用 `codex plugin list` 检查，`codex plugin remove <pluginId>@<pluginId>-market` 移除。

DeepSeek 解压后执行 `dsh plugin --profile workflow add <目录>`，通过 `dsh --profile workflow --dump-config` 检查，然后在该 profile 中明确调用 `document.json` 的 `toolName`，参数为 `{}`。原生工具只返回 `WORKFLOW.md` 全文，无任务输入、子 Agent、调度状态或权限扩大。移除使用 `dsh plugin --profile workflow remove <package.json中的name>`。

说明书告诉模型怎样协作；模型能否理解并遵循自然语言约定不等于程序强制。实际模型遵循度与任务质量未由本地脚本测试证明。文档包的原生入口需要支持上述版本宿主，但独立 Markdown 可直接提供给其他模型阅读。

## 高级可选：可执行图

仅当用户明确选择「高级程序执行插件」时启用以下运行器和结构校验；需要 Node >=24.9.0。其权限、子会话、状态与程序谓词要求不适用于默认说明书导出。

### 可执行模式安装、选择与移除

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

任务中选择唯一的 `<plugin_id_with_underscores>_run` 工具，传入 `input` JSON 字符串。工具使用真实 `ctx.subagents.startActivation`、原生 `spawn` 提供器、独立上下文、结构化结果和 `childId`；缺失服务会阻止加载，缺失独立提供器／结构化能力会产生 `blocked`。子执行保持宿主原生权限，并传入宿主 resolveMaxDepth 的委派深度上限；需要上限时也要求提供器支持 depthLimit，嵌套越界会阻塞。QA 修改候选会使检查失效。移除：`dsh plugin --profile workflow remove <plugin-id>`。

### 数据驱动的图合同 v3

可执行导出使用同一份冻结的项目 JSON，Codex 和 DeepSeek 加载相同的 `bundle.json` 与 graph/runner 模块。节点、角色数量和拓扑不再限定为开发／质检模板。旧项目格式仍为 schemaVersion 1，新增配置均为可选字段；旧开发／质检示例通过增加显式配置迁移成普通可编辑图，读取旧 IndexedDB 数据时将原数据保存为 `before-graph-migration`，不覆盖原始技能版本、资源和布局。旧合同 v2 的运行状态仍由兼容执行器读取。

- start、agent、human、join 使用一条顺序出边；condition 配置多个结构化谓词和唯一默认分支。谓词为 `{path,op,value}`，支持 eq/ne/gt/gte/lt/lte/exists/contains，不执行代码或自然语言。多个分支同时匹配时阻塞，避免隐含顺序。
- 任意回边的 `maxRetries` 是可配置次数，`fallback` 是耗尽后进入的退出节点。验证器检测移除有界回边后的残余循环，并包括耗尽后的退出路径；没有固定三次限制。
- fork 的所有出边同时派发独立 token。join 使用 `config.join.forkId` 对应 fork，等待同一次 fork 的全部分支。分支携带各自的数据快照，允许乱序完成。汇合合并不相交的数据写入，相同路径有不同值时报错；循环计数按每条边取最大值。共享工作区并行分支仅允许只读；配置为 workspace-write 会在派发前阻塞，绝不扩大授权。
- human 真正暂停。用户终端或宿主用户命令可提交 `continue`（必要时指定 nodeId，附带 data），然后沿图继续；也可显式结束为 accepted_with_risk/failed/cancelled。模型工具不能提交人工事件。end 的 config.terminal 为 success/failure/cancel，默认 success。已配置的独立评审失败不能通过人工 continue 变成 passed，必须显式接受风险或结束失败。

节点 `config`：`inputs` 把本地输入名映射到绝对读取路径；`outputFields` 声明必需输出字段和类型；`requiredOutputs` 额外要求结果字段存在；`outputs` 把结果 data 内的本地源字段路径映射到 `data.*` 共享目标路径。路径根为 task、input、data、nodes；例如 inputs `{source:"nodes.fetch.data.text"}`，outputs `{summary:"data.summary"}`。`nodes.<id>.data` 保留已执行节点的结构化结果。未声明 outputFields 时默认 `{text:string}`。标量 string/number/boolean 可直接声明；array 为字符串数组，object 为封闭空对象，嵌套任意 JSON 不在当前输出模式内。生成的宿主 JSON Schema 明确列出 required 和 additionalProperties:false。

每个 Agent 返回 `{status:"completed",data:{...已声明字段}}`。默认权限为 read-only；workspace-write 节点需要已有宿主授权。Codex 使用实际 --sandbox 参数，写入仍需用户启动器 opt-in。DeepSeek 在创建只读子会话前安装宿主单调工具 guard，只允许结构化提交和保守的读取工具名，拒绝 shell、PTC、写入和再委派；该 guard 只限制本次主会话创建的子会话，不能放宽宿主策略。写入节点继续使用宿主原生权限。

`config.review={candidateFrom,criteriaFrom}` 启用独立候选评审：候选必须来自指定已执行节点并匹配实际文件 SHA256，标准必须匹配原始任务标准哈希；输出须对每条原标准提供 checks 和证据。评审前后及恢复已完成任务时重新检查候选，变化会阻塞并使结果失效。普通图无需配置评审，也不硬编码任何角色名称。

状态存储 token 前沿、分支快照、汇合等待区、边计数、真实子会话 ID 和事件去重键。每次宿主派发前先原子持久化 dispatch_intent；中断恢复遇到未决意图或已启动子会话会阻塞，要求先检查实际子会话并显式 retry_dispatch，绝不静默重复派发。任务绑定注册表防止相同主会话和 taskId 切换插件／版本／状态文件。状态和备份只位于用户指定 workspace/.apd 路径。


## 当前默认文档模式验证

- `npm test`：52 项测试通过（23 个模型／导出测试 + 29 个运行时回归）；9 项浏览器测试通过，并单独加强验证资源与旧版本保留。
- `deliverables/document-ui/`：实际 UI 创建自然语言多分支、并行人工、草稿回路三份项目，绑定各自角色、技能 v1/v2 与资源，导出 3 Markdown、3 JSON、6 原生 ZIP 和 3 截图。`export-evidence.json` 记录全部 15 份文件的 SHA256。DOM 预览、单独 Markdown 与包内 `WORKFLOW.md` 逐字相等；草稿的双边、自回路和孤立节点完整保留。
- `node scripts/verify-document-hosts.mjs codex`：真实 Codex CLI 的隔离配置内同时安装并列出三包，逐包显式选择原生技能；实际本地模型请求包含所选说明书完整正文，且没有另两份完整正文。随后真实移除三包。证据 `deliverables/harness/codex-document-real-host.json`。
- `node scripts/verify-document-hosts.mjs deepseek`：真实 DSH CLI 安装／发现／移除三包；实际 Cordis／Session／AgentLoop 使用对应原生只读工具（参数 `{}`）。工具返回及随后本地模型消息中的字符串均逐字等于完整 Markdown，另两份全文未载入。没有加载子会话提供器或运行任务。证据 `deliverables/harness/deepseek-document-real-host.json`。
- 两种宿主证据都直接消费最终 UI ZIP，并核对 ZIP、Markdown、来源 JSON 与 UI manifest 哈希。CLI 与原生会话是真的；响应提供器是本地脚本，没有外部模型或付费调用。这证明原生安装和显式全文加载，不能证明模型遵循流程或任务质量，也不声称文档具有程序强制效果。
- Windows 本次 CI 待发布后验证。原生套件默认保存两个文档包并比较完整 Markdown／项目，再显式选择高级执行用途回归；Verification artifact 包含 Windows、document-ui、general-ui 与两类宿主 JSON。

## 高级可执行模式回归证据

- 高级执行运行时的 29 项确定性回归保留，模拟宿主测试不代表实际 Agent 运行。UI 全套测试重新生成的当前六包已重新执行以下真实宿主用例，来源哈希与当前 general-ui manifest 对齐。
- `deliverables/general-ui/`：通过真实 UI 创建／编辑的三种流程：3 Agent 共用 1 角色的顺序流、多分支／默认路由／2 次有界循环／人工流、乱序并行汇合流。包含三份可编辑项目、六个实际导出的 Codex／DeepSeek 原生 ZIP、截图与 `export-evidence.json` 哈希证据。
- `node scripts/verify-host-install.mjs`：两个实际 CLI 在隔离配置中分别安装／发现／移除上述三个插件；证据 `deliverables/harness/general-real-host-install.json`。
- `node scripts/verify-codex-host.mjs`：实际 Codex CLI 与 localhost 脚本 Responses 服务，9 个场景、18 个真实独立子线程；实际主线程逐个显式选择三个已安装 namespaced 技能，验证只加载所选技能正文。证据 `deliverables/harness/codex-general-real-host.json`。
- `node scripts/verify-deepseek-host.mjs`：实际 Session／AgentLoop／spawn 与本地脚本 LlmAdapter，9 个场景、18 个真实独立子会话；原生深度上限仍为 1，子会话不继承主会话私有上下文。证据 `deliverables/harness/deepseek-general-real-host.json`。
- 两个宿主均验证顺序、成功分支、默认失败、循环耗尽人工暂停、人工继续／取消、乱序并行汇合、损坏结果阻塞、实际中断、幂等事件与恢复不重复派发。DSH 人工动作走实际用户命令边界；Codex 人工继续／取消均调用实际导出的 `scripts/human.mjs`，在真实 PTY 中按 Outcome／Reason 提示输入，并验证非 TTY 调用被拒绝。两者均为脚本化用户输入的边界测试，未冒充实际用户决定。
- DSH 子会话实际调用会写文件的测试工具，宿主 guard 返回 `Workflow read-only child: tool denied by host guard`，文件未产生。Codex 实际 `exec_command` 写入探针在执行 shell 前被环境阻止：`error building bubblewrap command: app-server socket directory must be a user-owned directory with mode 0700`。文件未产生，但这不能证明本环境中的文件系统只读强制；报告保留这一限制，未授予额外权限或修改全局 socket。
- Windows 套件保留持续拖动、原生保存／取消／导入、两项目重启全量比较，并检查两个宿主 ZIP 的原生保存、入口清单、contract v3 与原始项目全量比较。1.3.0 本次 Windows CI 尚待发布后运行，以最终状态为准。
- 原 contract v2 的验证脚本保留为 `scripts/verify-*-host-legacy.mjs` 与 `scripts/verify-host-install-legacy.mjs`；旧 `codex-real-host.json`／`deepseek-native-host.json`／`real-host-install.json` 是历史证据。
- **未调用外部模型，也未进行付费调用。** 本地脚本结果不是实际模型生成代码／QA 的质量评测。

官方依据：

- [OpenAI 插件格式](https://developers.openai.com/plugins/build/plugins)、[Codex 插件](https://developers.openai.com/codex/plugins)、[非交互模式](https://developers.openai.com/codex/noninteractive/)；实际安装 CLI 的 `--help`、`plugin add/list/remove` 和 `exec --json --output-schema` 已核验。
- [DeepSeek 官方源码](https://github.com/deepseek-ai/deepseek-harness)、[插件打包安装](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)、[子会话](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subagent.md)。研究 master 为 `ce7073d51254c26cd63b22a60835b8f948deb447`（0.2.2-alpha.2）；**支持版本以实际 npm 安装 0.2.1-rc.5 为准**，已按其发布 `.d.ts`／代码验证 `startActivation`、结构化结果、注入和人类命令，未直接假定 master API 兼容。

复现原生证据：默认文档模式保留 `deliverables/document-ui/` 并执行两个 `verify-document-hosts.mjs` 命令；高级模式保留 `deliverables/general-ui/`，执行其三个验证命令。均从仓库根目录运行。Codex 需要受支持的实际 CLI，可用 `APD_CODEX_BIN` 指定原生二进制；DSH 先在隔离目录安装 `@deepseek-ai/dsh@0.2.1-rc.5`，用 `APD_DSH_NODE_MODULES` 指向该目录的 node_modules，用 `APD_DSH_BIN` 指定安装测试所用的 CLI。测试只创建隔离的临时宿主配置与工作区，不复制用户授权，不调用外部模型。旧双插件夹具的复现使用相应 `*-legacy.mjs`，不应与当前六包证据混用。

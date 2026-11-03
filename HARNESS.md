# 流程说明书与可选宿主执行

本次更新：默认模型入口读取精简且完整的有效流程指令 `WORKFLOW.instructions.md`；`WORKFLOW.md` 保留完整归档，仍与独立 Markdown 一致。下文早期验收记录仅代表其当时版本，不能当作本次运行器的宿主验收。当前固定任务评测及阻挡证据见 [evaluation/README.md](evaluation/README.md)，运行预算/恢复见 [runtime/LIMITS.md](runtime/LIMITS.md)。

支持 **Codex 0.159.0-alpha.3** 与 **DeepSeek Harness 文档模式 0.2.1-rc.3／0.2.1-rc.5**。默认选择「导出插件 → 流程说明书插件 → 宿主可安装 ZIP」。用户自由配置节点与连线，大模型阅读并使用完整说明书；默认模式不运行任务，不强制调度。宿主安装与全文加载证据来自 Linux；Windows 原生应用导出 ZIP 与 Windows 宿主执行是独立事项。Windows／WSL 宿主尚未验证；只有高级 Codex CLI 适配器才要求 Windows 启动环境的 APD_CODEX_BIN 指向原生 codex.exe，禁止 shell:true 的 npm shim。

默认 Codex 输出是原生插件（`.codex-plugin/plugin.json`、显式调用技能、独立 marketplace）；技能正文内嵌有效流程指令，归档另存。默认 DeepSeek 输出是原生 Cordis bundle（`package.json` 的 `dsh.bundle`、patch 与只读文档工具），工具仅返回有效流程指令全文。均无任务运行器、子会话依赖、安装脚本、后台服务或权限授予。

## 默认：流程说明书插件

`WORKFLOW.md` 与独立 Markdown 下载逐字一致，包含所有节点、连线、自然语言条件、技能固定版本与文本资源内容。`project.agent-project.json` 是完整可编辑来源；`document.json` 标记 `mode:documentation`、目标宿主、真实 pluginId／toolName 与非阻断提醒。内容摘要参与原生包名，不同来源／内容可以共存。草稿、未结构化分支与不完整流程仍能导出；提醒仅帮助作者完善说明。

Codex 解压后执行 `codex plugin marketplace add <目录>`、`codex plugin add <pluginId>@<pluginId>-market`，任务中复制导出窗口的完整使用指令；默认明确选择 `$<pluginId>:guide`，旧兼容模式以 `document.json` 的 invocation 为准。原生技能直接加载有效流程指令，不运行 Node 脚本，不要求 `APD_CODEX_DEVELOPER_SANDBOX`。用 `codex plugin list` 检查，`codex plugin remove <pluginId>@<pluginId>-market` 移除。

DeepSeek CLI/Web：解压到固定目录，执行 `dsh plugin --profile web add "绝对解压目录"`，用 `dsh --profile web --dump-config` 检查，在同一 profile 明确调用 `document.json` 的 `toolName`，参数 `{}`。只返回 WORKFLOW.instructions.md，不运行任务。移除使用 `dsh plugin --profile web remove <package.json中的name>`。

DeepSeek Desktop 的 `desktop` profile 与 CLI/Web 不同；npm CLI 拒绝管理它。桌面先运行一次初始化，再完全退出。找到 `DeepSeek Harness.exe` 所在的实际安装目录，使用它自带的命令，不使用 npm 全局 dsh：

```powershell
& "C:\实际桌面安装目录\resources\runtime\cli\bin\dsh.cmd" --version
& "C:\实际桌面安装目录\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\固定解压目录\说明书插件"
```

然后重开 Desktop，明确要求模型调用包内工具名 `{}`，先读取全文再处理任务。不能把文档读取成功报为任务完成。移除前退出桌面，使用同一内置命令 `plugin --profile desktop remove <包名>`。以上路径／管理机制已核对 [准确 rc.3 tag](https://github.com/deepseek-ai/deepseek-harness/blob/1f81c047fc48fa190a683e469daa699857e9afe8/apps/desktop/README.zh.md#bundled-command-runtime)，不要求先升级 rc.3；打包 Desktop UI 尚未实测。

说明书告诉模型怎样协作；模型能否理解并遵循自然语言约定不等于程序强制。实际模型遵循度与任务质量未由本地脚本测试证明。文档包的原生入口需要支持上述版本宿主，但独立 Markdown 可直接提供给其他模型阅读。

## 1.4.1：显示名称、机器调用与旧入口

`documentNaming` 是可选项目设置：英文 shortName 最多 32 字符，英文字母开头，后续可用英文字母、数字、连字符、下划线；空值自动选择可用短名，全中文自动值为 workflow。readable 是默认，legacy 必须明确开启。默认包名由可读短名、12 位来源摘要和 guide 构成；默认摘要来自不含命名设置和节点坐标的冻结来源。readable-v1 显式保留旧 1.4.1 算法，legacy 保留旧 1.4 算法。相同来源重复导出稳定；内容、身份或版本改变时摘要可能变化，改变短名会改变完整调用。

metadata 区分 displayName、shortName、pluginId、toolName、skillName、invocation 与 invocationText。invocation 是纯机器入口；invocationText 是可复制给模型的中文指令，包含流程名、真实入口与先读全文再处理任务的要求，DSH 还明确参数 `{}`。不得把中文使用指令当机器函数名。默认 Codex skill 固定 guide，qualified plugin:skill 不超过公开 64 字符限制；旧本地安装的兼容格式保留原 skill，不据此声称符合新的公开提交约束。

legacyIds 保存精确旧 1.4 入口映射。import 仍生成新项目 ID，并以只读 legacySourceId 锚住原身份；legacy helper 删除新命名字段、还原原 ID，从未改的旧内容／版本复现旧包标识。copy 清锚、默认 readable、保留自定义短名。默认新旧入口可独立同时安装；不自动注册 legacy 别名，不修改用户安装。显式兼容包与原包同 ID，不能当作第二个新包重复注册，只能按宿主规则由用户更新。

可控边界：Codex agents/openai.yaml 的 interface.display_name 是技能显示元数据；DSH 包 exports/locale 的 meta.title 是插件管理标题。中文工具 description 发给模型，但不等于 DSH 通用调用行标题；Host-local presentCall/presentResult 也不会自动作用于 Web Client。调用行、会话 UUID 和消息目标仍属于宿主。主模型委派时可用角色名填写 description 改善 lineage label，但发送消息仍需真实 SessionId／合法目标，不能用显示名伪造目标。普通与 experimental send_message 的参数语义不同，不能假定桌面已启用具名 teammate。准确 rc.3 官方源码依据及边界见 `readable-name-official-review.json`；没有读取截图或修改 DSH。

## 1.4.0 普通连线与简易输入输出

连线语义根据来源节点决定：普通节点出口是顺序连接，默认源节点完成后继续；condition 出口才是条件分支，可选默认分支；fork 出口是并行分发。`note` 是可选连接说明，不代替条件。旧普通／并行边的非空 `condition` 继续显示为“原有流转要求”，不能偷偷解释成无条件。说明书逐条保留全部边及原有约束。

角色只需名称和职责，节点只需任务与负责人。无明确约定时承接所有实际到达的上游结果、交付步骤完成结果，交接为空不再产生必填提示。多入边列出全部来源，但普通连接不等待未触发分支，也不擅自决定业务合并；join 等待对应并行分支。既有 config 输入映射／输出定义优先，其次角色旧详细约定，其次节点可选 delivery，最后默认；高优先约定下 delivery 仍列为补充，不丢内容。高级配置继续可编辑，不改变旧 schemaVersion 1 数据。

## 1.4.0 AI 草案连接

AI 为可选桌面 Go 连接，不是任务执行器。用户配置自己的地址、模型与会话 Key，只有明确发送后请求非流式 Chat Completions 文本协议。默认只发送当前描述；选中节点和整个流程的共享逐次确认，不自动发送历史对话。Key 不持久化、不进入导出或日志。远程 HTTP 需要确认，localhost 模拟服务无需远程风险许可。生产页面 CSP 保持不允许直接外网；网络仅由专用桥处理。

请求取消、45 秒超时、401／429／网络失败有受控提示。响应大小、严格草案 schema、引用、规模与选中范围均校验；拒绝工具调用和未知字段。草案不直接改图；用户应用时核对来源指纹，单步撤销；已应用或过期草案不能重复覆盖。只兼容 README 所述文本协议，未宣称真实厂商、Responses、Azure、图像或流式支持。

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


## 当前 1.4.1 命名验证

- 主 npm test：84 项通过（23 model、21 harness、11 AI、29 runtime）。浏览器原完整命名套件 23 项通过；另有真实历史迁移专项 1 项通过，是两次独立运行，未合并成伪造的单次 24 项。机器报告／原始日志分别保留。
- `deliverables/naming-ui/` 六组、24 份 MD／JSON／ZIP 与 manifest：同中文名称的不同项目及版本、显式 legacy、真实旧 1.4 来源导入后的 readable／compatible。历史原包不改，compatibility archive 与原旧 ID 精确对应；相同 ID 的 archive 只核对导出，不重复安装。
- `node scripts/verify-document-hosts.mjs codex scripts/document-naming-fixtures.json` 实际同时安装 4 新 readable 与原 1.4 legacy 共 5 包，逐个完整说明书选择隔离。真实 app-server skills/list 解析 4 个新 skill 的中文 interface.displayName；不声称已验收其 GUI 渲染。兼容导出则静态核实旧 ID／skill／调用与来源投影精确一致。
- DSH rc.3／rc.5 均实际同时安装同一套 5 包，逐个原生工具全文与选择隔离通过。另在 rc.3 使用官方 `readPluginMeta(pluginId,parentURL)` 实际解析 4 个新包，`title.zh` 与中文显示名称逐一相同：`node --expose-internals --input-type=module` 导入 `@deepseek-ai/dsh-app-boot/lib/index.js`，在隔离临时目录建立包名 symlink，以该目录 entry.mjs 的 file URL 为 parentURL。证据 `deepseek-rc3-naming-metadata-real-host.json`；rc.5 本轮仅声明原生文档调用验证，不冒充额外 loader 读取。metadata 数据读取不代表 Desktop GUI 或工具卡标题已渲染；没有改动用户 profile 或使用 --force。
- 1.4.1 Windows 发布后运行原完整 native／初心者／AI／drag 回归；新增中文显示、短名设置、实际复制按钮→Windows OS Get-Clipboard 全文比较、同来源重复导出稳定、新旧模式完整来源与 import 锚断言。此处不能用浏览器 mock clipboard 代替原生证明；若复制被拒绝须报告，不扩大所有权限。当前 Windows CI 仍待本次最终结果。
- 全部宿主模型响应为本地脚本，不是真实提供器质量评测或付费调用。DSH 打包 Desktop UI 和工具卡片视觉呈现仍未实际验收。本轮只读代码／纯文字／JSON，不访问图片或 Library；1.4 的 API/IO/原生回归保留。

## 1.4.0 历史验证

- 主 `npm test`：74 项通过（23 model + 11 harness + 11 AI + 29 runtime）；Go AI 的 8 组 std-only 测试与本地 race 检查通过。Windows CI 执行 `go test ai.go ai_test.go`，不要求 UI 编译依赖。
- 最终浏览器 21 项通过，机读报告及原始日志保存；9 个 AI 场景明确使用模拟 bridge，不代表原生网络或真实模型质量。覆盖草案预览／应用／撤销、create/append/selected、逐次共享确认、取消与迟到、冲突、错误、未知／悬空／超量／工具调用、双击与 Key 不入项目／MD／ZIP／存储。
- `deliverables/edge-ui/` 是本轮新 UI 交付：mixed-connections、legacy-constraints、beginner-defaults 三组项目／MD／双宿主包，共 12 个文件的 SHA256 在 manifest。无输入输出的新手角色、普通无条件连接、原有要求与多上游默认承接都保存并导出。本轮只检查代码、DOM、文本和日志，不访问任何截图。
- `node scripts/verify-document-hosts.mjs codex scripts/document-edge-fixtures.json` 与同命令 `deepseek`：真实 Codex／DSH rc.5 各同时安装／发现／移除三包，逐个显式加载完整说明书，另两份全文不进入上下文。证据 `codex-edge-document-real-host.json`、`deepseek-edge-document-real-host.json`。
- DSH rc.3 同样真实安装三包并通过原生 Session／AgentLoop 的完整返回、模型消息全文一致及选择隔离；证据 `deepseek-rc3-edge-ui-document-real-host.json`。准确官方 tag／打包链证据为 `deepseek-rc3-official-review.json`。没有 --force peer 绕过、没有外部模型或用户环境修改；Desktop UI 仍未实测。
- 1.4.0 Windows 本次 CI 待发布后验证。native 保留全部原保存／取消／导入、13 次拖动、两项目重启、两个文档包的 MD／源图与显式高级导出；追加初心者真空白基本表单→导出→导入→四项目重启，以及真实 Go bridge 访问同机 HTTP mock 的 AI 验收。自动图片仅保留 artifact，不打印图片 base64，也不读取或物化图片。
- `document-ui/`、`general-ui/` 与其原宿主 JSON 是 1.3.0 冻结历史证据，未覆盖。本轮实际宿主识别只使用新 edge-ui 包，不扩展或重跑可选执行调度。

## 1.3.0 高级可执行模式历史回归证据

- 高级执行运行时的 29 项确定性回归保留，模拟宿主测试不代表实际 Agent 运行。UI 全套测试重新生成的当前六包已重新执行以下真实宿主用例，来源哈希与当前 general-ui manifest 对齐。
- `deliverables/general-ui/`：通过真实 UI 创建／编辑的三种流程：3 Agent 共用 1 角色的顺序流、多分支／默认路由／2 次有界循环／人工流、乱序并行汇合流。包含三份可编辑项目、六个实际导出的 Codex／DeepSeek 原生 ZIP、截图与 `export-evidence.json` 哈希证据。
- `node scripts/verify-host-install.mjs`：两个实际 CLI 在隔离配置中分别安装／发现／移除上述三个插件；证据 `deliverables/harness/general-real-host-install.json`。
- `node scripts/verify-codex-host.mjs`：实际 Codex CLI 与 localhost 脚本 Responses 服务，9 个场景、18 个真实独立子线程；实际主线程逐个显式选择三个已安装 namespaced 技能，验证只加载所选技能正文。证据 `deliverables/harness/codex-general-real-host.json`。
- `node scripts/verify-deepseek-host.mjs`：实际 Session／AgentLoop／spawn 与本地脚本 LlmAdapter，9 个场景、18 个真实独立子会话；原生深度上限仍为 1，子会话不继承主会话私有上下文。证据 `deliverables/harness/deepseek-general-real-host.json`。
- 两个宿主均验证顺序、成功分支、默认失败、循环耗尽人工暂停、人工继续／取消、乱序并行汇合、损坏结果阻塞、实际中断、幂等事件与恢复不重复派发。DSH 人工动作走实际用户命令边界；Codex 人工继续／取消均调用实际导出的 `scripts/human.mjs`，在真实 PTY 中按 Outcome／Reason 提示输入，并验证非 TTY 调用被拒绝。两者均为脚本化用户输入的边界测试，未冒充实际用户决定。
- DSH 子会话实际调用会写文件的测试工具，宿主 guard 返回 `Workflow read-only child: tool denied by host guard`，文件未产生。Codex 实际 `exec_command` 写入探针在执行 shell 前被环境阻止：`error building bubblewrap command: app-server socket directory must be a user-owned directory with mode 0700`。文件未产生，但这不能证明本环境中的文件系统只读强制；报告保留这一限制，未授予额外权限或修改全局 socket。
- Windows 套件保留持续拖动、原生保存／取消／导入、两项目重启全量比较，并检查两个宿主 ZIP 的原生保存、入口清单、contract v3 与原始项目全量比较。1.3.0 Windows 已有独立成功记录，不能代替 1.4.0 本次 CI。
- 原 contract v2 的验证脚本保留为 `scripts/verify-*-host-legacy.mjs` 与 `scripts/verify-host-install-legacy.mjs`；旧 `codex-real-host.json`／`deepseek-native-host.json`／`real-host-install.json` 是历史证据。
- **未调用外部模型，也未进行付费调用。** 本地脚本结果不是实际模型生成代码／QA 的质量评测。

官方依据：

- [OpenAI 插件格式](https://developers.openai.com/plugins/build/plugins)、[Codex 插件](https://developers.openai.com/codex/plugins)、[非交互模式](https://developers.openai.com/codex/noninteractive/)；实际安装 CLI 的 `--help`、`plugin add/list/remove` 和 `exec --json --output-schema` 已核验。
- [DeepSeek 官方源码](https://github.com/deepseek-ai/deepseek-harness)、[插件打包安装](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)、[子会话](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/subagent.md)。此段仅为高级可执行模式的旧 rc.5 API 依据：研究 master 为 `ce7073d51254c26cd63b22a60835b8f948deb447`（0.2.2-alpha.2），执行适配器按实际 npm 0.2.1-rc.5 的发布类型／代码验证 startActivation、结构化结果、注入和人工命令。当前说明书模式的 rc.3／rc.5 支持以准确 rc.3 tag、两版本实际发布包与上方 edge-ui 真实宿主证据为准。

复现 1.3.0 历史证据：旧文档模式保留 `deliverables/document-ui/` 并执行原默认 `verify-document-hosts.mjs` 命令；旧高级模式保留 `deliverables/general-ui/`，执行其三个历史验证命令。本轮 1.4.0 请使用上方 `scripts/document-edge-fixtures.json` 与 rc.3 专用脚本，直接消费 `deliverables/edge-ui/`。均从仓库根目录运行。Codex 需要受支持的实际 CLI，可用 `APD_CODEX_BIN` 指定原生二进制；DSH 先在隔离目录安装 `@deepseek-ai/dsh@0.2.1-rc.5`，用 `APD_DSH_NODE_MODULES` 指向该目录的 node_modules，用 `APD_DSH_BIN` 指定安装测试所用的 CLI。测试只创建隔离的临时宿主配置与工作区，不复制用户授权，不调用外部模型。旧双插件夹具的复现使用相应 `*-legacy.mjs`，不应与当前六包证据混用。

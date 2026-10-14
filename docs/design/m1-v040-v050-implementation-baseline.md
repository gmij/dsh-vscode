# M1 · v0.4.0 / v0.5.0 设计冻结与实施基线（2026-10-14）

状态：**设计评审基线/实施任务分解**；非真实 ACP 功能验收。来源：[Overview #11](https://github.com/gmij/dsh-vscode/issues/11)、[v0.4 Detailed #12](https://github.com/gmij/dsh-vscode/issues/12)、[v0.5 Detailed #13](https://github.com/gmij/dsh-vscode/issues/13)。本文件覆盖过时的 SecretStorage-only 和 GitHub Label 调度说法。

## 架构冻结

VS Code **Webview / Activity Bar** → Extension Host **WorkspaceController** → 现有 **ACPClient** → 本地 `dsh --profile acp`（JSON-RPC stdio）→ 用户选定的 HTTPS Provider。**不存在供桌面使用的 HTTP `/api/acp/*` 服务**。本地工作区与 GitHub 原生 Assign to Agent → Custom Agent → MCP Dispatcher → DSH Actions 是两个执行路径；**不得**为了 UI 把前者误接后者，也不能以 Label 作为正式 Agent 分派入口。

保留 `src/acp.js`, `src/profiles.js`, `src/project_profiles.js`, `src/extension.js` 的已有能力；封装而非复制。版本边界：

- **v0.4.0**：可见的工作区设置入口 + 最小 ACP 验证 Webview + 可信控制器；真实 connect/new/prompt/update/permission/cancel/list/resume、项目/模型隔离，故障与 Mock/真实证据区分。
- **v0.5.0**：复用同一控制器和 IPC，正式 Activity Bar 侧栏，流式 Markdown/代码块、会话导航、权限卡片、状态处理、配置入口和可访问性。不得开发第二套 ACP/权限状态机。

## 配置契约和安全

`.dsh/ai-profiles.json`（schemaVersion=1）含 `profiles: [{id,name,baseURL,api,models,apiKey?}]`，`api` 枚举 `openai-completions|openai-responses|anthropic-messages`，`apiKey` 为用户主动填写的可选明文字符串。插件显式支持**项目文件读取优先**，本机 SecretStorage 为向后兼容的回退；显示当前凭据来源，但**绝不**向 Webview 发送 API Key（仅 `hasCredential`）。项目文件访问限制为绑定的规范化 workspace 根；默认 `.gitignore` 忽略，写入 `0600`，检查 `git ls-files --error-unmatch .dsh/ai-profiles.json` 防止已跟踪文件误提交；不在日志、Issue、Wiki、Artifact、VSIX、诊断及错误里记录凭据；发现泄露立即轮换。**这仍是高风险临时方案，不是企业集中密钥管理**。GitHub hosted runner 无法自动读取开发者本地未提交文件；其模型真实测试须受控自托管执行环境提供配置，CI 仅用无密钥 fixture/mock。

## v0.4.0 通道冻结

统一消息信封 `{version:1,requestId:string,type:string,payload:object}`；Host 回复 `{version:1,requestId,ok:boolean,data?:object,error?:{code,message}}`；Host 推送 `{version:1,event,sequence,sessionId?,turnId?,payload}`。每条请求只允许列出字段，Webview 不拥有 cwd/session 安全归属/密钥。host 校验请求 ID、最大消息大小、会话状态、所有权、错误枚举；未知/重复请求不重复提交 `session/prompt`。

| IPC | 方向 | 意图和必需载荷 | ACP 映射 | UI |
|---|---|---|---|---|
| IPC-01 | UI→Host RPC | `connect {profileId,modelId,resume?:boolean}` | initialize,new/resume | 连接/新建 |
| IPC-02 | UI→Host RPC | `prompt {text,requestId}` | session/prompt（不得自动重发） | 输入/发送 |
| IPC-03 | Host→UI notification | `session.update {sequence,kind,payload}` | session/update | 流式输出 |
| IPC-04 | Host→UI event + UI→Host decision | `permission.request {ticketId,summary,options}` / `permission.respond {ticketId,optionId|null}` | session/request_permission，超时或未知默认拒绝 | 审批卡 |
| IPC-05 | UI→Host RPC | `cancel {requestId?}` | session/cancel（以锁定版实测为准） | 取消 |
| IPC-06 | UI→Host RPC | `listSessions {}` / `resume {sessionId}` | session/list、session/resume | 会话恢复 |
| IPC-07 | UI→Host RPC | `selectProfile {profileId,modelId}` | 显式停旧会话，隔离创建/恢复 | 模型切换 |
| IPC-08 | UI→Host RPC | `status {}` | host status（不伪造 HTTP） | 状态 |
| IPC-09 | UI→Host RPC | `setupProject {}` | 现有 Setup Project 受控命令 | 工作区配置入口 |
| IPC-10 | UI→Host RPC | `manageProfiles {}` | 现有 Manage AI Endpoints 受控命令 | 工作区配置入口 |

注意：原 Detailed 的 IPC-01..08 为基线；IPC-09/10 是明确新增的 UI 入口适配约束，需经过实现与 Schema 测试。Push 事件的 `response` 为 `null`；UI 字段源来自 **通知请求载荷**，不是 null response。权限票据一次性、过期默认拒绝；必须显示工具名、影响和可选的最小权限选项，不能自动接受。

## v0.4.0 UI-01 最小验证 Webview

状态 `unbound → unconfigured → disconnected → connecting → ready → streaming → awaitingPermission → completed|cancelled|failed|unknown`；支持 loading/empty/error/success 四态。用户可在左侧 Explorer 或命令面板显式打开“DSH 工作区设置”，看到仓库、Git 工作目录、已绑定状态、站点列表/模型、配置来源及检查连接/聊天入口。无仓库时点击“绑定项目”调起现有 Setup Project，无 Provider 时点击“配置 AI 站点”。**无论是否已配置都能打开设置页**。敏感 API Key 不在 UI 消息里传递或渲染。

接收 prompt 后按原生更新分片追加；每段带 `sessionId,turnId,sequence`，拒绝陈旧会话和乱序更新。错误不被当成模型文本；403 不重试，cancel 后不自动重复 prompt，未知终态须显式确认。Webview 必须使用随机 nonce CSP、禁远程脚本、所有文本 `textContent` 或安全渲染，限制 message 类型大小。

## v0.5.0 UI-02 正式聊天侧栏（同一 Host）

Activity Bar 容器 `dshWorkspace`，视图 `dshWorkspace.chatView`；状态栏连接/模型；顶部：项目+Provider/模型、设置入口；中部：按消息/工具调用分块渲染的流式对话，支持可复制代码块、自动滚动、空/错误/加载/断线；底部：多行输入、发送、停止按钮；会话导航：新建/列举/恢复，不跨 profile 自动共享历史。审批卡片不共享长期授权，显示票据过期反馈。窄栏适配 320px，键盘操作、焦点、ARIA live 区域、屏幕阅读器可读。Markdown 渲染需要白名单消毒，严禁把模型回复当 HTML 执行；不把日志或敏感 workspace 片段自动持久化。

## 任务分解与严格依赖

| ID | 版本 | 层 | 任务 / 验收条件 | 依赖 |
|---|---|---|---|---|
| M1-01 | 0.4 | integration | 锁定 DSH 版本/integrity、实测 ACP 方法与 tool permission 语义，产生脱敏协议矩阵（Mock != 真实） | 无 |
| M1-02 | 0.4 | backend | WorkspaceController 封装 ACPClient/ProjectScope/SessionStore，严格 IPC 路由和取消/重放保护；单测 | M1-01 |
| M1-03 | 0.4 | backend | 项目文件凭据读取/回退、git 跟踪检查、脱敏和本地配置来源；单测 | M1-01 |
| M1-04 | 0.4 | frontend | 可直接打开的设置/验证 Webview 和空态/错误态；单测/键盘 | M1-02,M1-03 |
| M1-05 | 0.4 | integration | Mock IPC/ACP 闭环及故障注入，真实两轮 prompt、permission allow/deny、sessionId resume、VSIX E2E 证据；阻断如实记载 | M1-02,M1-03,M1-04 |
| M1-06 | 0.5 | frontend | Activity Bar 正式聊天侧栏，复用 Controller/IPC，Markdown、流式输出、审批、模型/会话切换 | M1-05 |
| M1-07 | 0.5 | integration | Windows/macOS/Linux 安装、CSP/无密钥泄漏、重启、取消、性能与无障碍回归，最终 VSIX 发布/回滚 | M1-06 |

**实施门禁**：每个开发 Issue 独立 PR 和测试；不以构建成功代替真实 ACP 证据。GitHub 开发 Agent 的任务通过原生 **Assign to Agent** 指派，复用现有 `.github/agents/*.agent.md` + MCP → DSH，**不用 `agent:*` Label 作为入口**。云端写码 Agent 目前尚未验证，不能声称原生指派必然会提交 PR；无法运行时明确阻断，由可信开发执行环境完成任务。

## 发布与回滚

0.4 先让用户安装 VSIX 后**看到可打开的工作区设置**，然后才要求真实 ACP；0.5 实现侧栏。每版必须输出 VSIX、SHA-256、版本、三平台结果、屏蔽 Key 的测试日志、Mock/真实差异和回滚步骤。0.4 回退到已安装的 0.3.1，0.5 回退到验证过的 0.4；不同版本的 SessionStore 不覆盖旧数据。未完成真实验收不关闭 M1。

# DSH VS Code — Issue 驱动开发工作流

核心目标：使用 DeepSeek Harness (DSH) + GitHub Actions，以本仓库的 GitHub Issues 为需求入口，自动指派 Agent 进行分析、设计和原型交付，并逐步扩展至开发与测试。

## 已接入：Issue → Agent → Actions → Issue

1. 在本仓库 Issues 创建需求，写明验收条件。
2. **优先使用原生 Assign to Agent → Custom agent**，选择 DSH Reviewer / Prototype / Overview Design / Detailed Design 等角色；`agent:*` 标签仅保留为兼容回退。
3. 原生 Custom Agent 通过 `scripts/dsh_dispatch_mcp.py` 提供的 MCP `dispatch_issue` 工具调用本仓库 `.github/workflows/dsh-issue-agent.yml`；Actions 运行时从已验证的执行仓库加载 Registry、Router、脚本及提示词。
4. 使用本仓库的 Issue 与源码作为任务上下文，在本仓库 Actions 内运行无头 DSH。
5. 将结果写回当前 Issue，原型和设计附件保留在当前仓库 Actions Artifacts。

**能力边界**：现在只有 connectivity、reviewer、prototype、overview、detailed 等模式，源引擎关闭了代码修改工具。能自动交付分析、原型和设计，但目前不能真正自动修改代码并创建 PR。开发、测试 Agent 和 PR 交付仍需后续实施。

## 当前验收

- [x] 新仓库已通过 Actions 初始化 Agent 标签与执行路由。
- [ ] Issue 真实触发 Agent 执行并回写结果。
- [ ] 实现能够修改源码、运行测试、创建 PR 的开发 Agent。
- [ ] 将持续对话、项目绑定和 Discussions 同步接入 VS Code。

## 项目结构

- `src/`: VS Code 扩展骨架和 GitHub 项目绑定。
- `.github/workflows/dsh-issue-agent.yml`: Issue 自动分派 Agent（核心）。
- `.github/workflows/ci.yml`: 扩展 CI。
- `docs/architecture.md`: 设计和边界。

`dsh-factory.code-workspace` 只是可选的本地调试配置，并非项目集成或 Agent 分派所必需。

## 原生 Agent 分派使用前提

- `.github/agents/*.agent.md` 和 `scripts/dsh_dispatch_mcp.py` 已迁入本仓库，MCP 目标固定 `gmij/dsh-vscode`。
- 需要为本仓库的 GitHub Copilot Agents 配置 `COPILOT_MCP_DSH_DISPATCH_TOKEN` Secret（只赋予本仓库 Issues read、Actions write 等最小权限）；普通 Actions Secrets 不会自动向原生 Agent MCP 提供凭据。
- 将 Custom Agent 的实际调度视为 **待联调**：配置尚未验证，不能因为 Actions CI 成功就断言原生 Assign to Agent 已经成功执行。
- 原兼容 `issues` 事件仍存在，但未来流程以原生 Custom Agent → MCP → `workflow_dispatch` 为主。


## VSIX v0.2.0 · 本地 ACP 预览

此版本加入 `DSH Workspace: Chat via Real ACP` 命令。它会在**本地**启动 `dsh --profile acp`、以绑定的 Git 工作目录作为 ACP `cwd`，使用原生 `session/new` / `session/prompt` 交互，记录原生 sessionId，下一次打开时尝试 `session/resume`。不使用伪造模型响应。当前界面是 VS Code InputBox + OutputChannel 的最小可测入口，不是最终 Webview 聊天界面。

### 安装与准备

1. VS Code 1.95 或更高版本，命令面板选择 **Extensions: Install from VSIX...** 安装 Actions 的 `dsh-workspace-0.2.0.vsix`。
2. 在本地 Node.js 环境安装 `npm install -g @deepseek-ai/dsh@0.2.1-alpha.2`，确认终端执行 `dsh --help` 可运行。
3. 需要在本地 DSH 配置**真实可用的模型 Provider 凭据**。如果本地使用自定义 provider，可在 VS Code Settings 配置 `dshWorkspace.provider` 和 `dshWorkspace.model`；仅设置名称不等于具备 API 权限。
4. 命令面板运行 **DSH Workspace: Setup Project** 绑定目录，再运行 **DSH Workspace: Chat via Real ACP**。持续输入两轮内容，观察 **DSH ACP Chat** OutputChannel。
5. 按 Esc 结束会话，再运行相同命令。应显示恢复**相同的 sessionId**；若恢复失败会报错，不会悄悄新建另一个会话。

### 预览限制与测试边界

- 工具权限请求在 VS Code 中显示审批选项，必须由用户亲自选择授权；按 Esc 或无匹配选项会**默认拒绝**（fail-closed）。是否真正收到与执行工具调用仍须通过本地 DSH 实测。
- 本地需能调用 `dsh` 命令，且 DSH 所需 credentials 必须自行完成安全配置；扩展不收集或保存 API Key。
- GitHub Actions 的原生 ACP 验证已证实 `initialize`、`session/new`、`session/list`、`session/resume` 可以工作；连续模型调用目前卡在 GitHub Actions Token 缺少 `Copilot Requests` 权限（403）。不能将该测试结果写为已通过。
- GitHub Actions 设计生成成功、Pages/Wiki 发布成功，与本地 VS Code 聊天和实际工具调用验收是独立事项。实际的对话文本与工具流仍需本机测试。

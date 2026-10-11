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

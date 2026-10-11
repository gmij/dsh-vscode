# DSH Workspace for VS Code

使用 **DeepSeek Harness (DSH)** 作为 Agent Runtime 的 VS Code 工程工作台。本项目不是 Nous Research Hermes Agent。

## 现已提交（M0 初版）

- `DSH Workspace: Setup Project`：选择本地 Git 目录，校验 `origin`，验证 GitHub 仓库访问权限。
- `DSH Workspace: Check Project`：读取远程 Issues 和 Milestones。
- `DSH Workspace: Open Discussions`：打开 GitHub 讨论区（尚未实现会话同步）。
- `DSH Workspace: Run Existing Agent Workflow`：人工确认后触发 `gmij/dsh-actions-connectivity` 的现有 `run-agent.yml` 连通性任务。
- 基于 VS Code `workspaceState` 存储当前绑定；包含单元测试与 GitHub Actions CI。

**尚未完成**：DSH 原生聊天桥接、独立项目引导 Webview、Conversation→Discussion 写入、GitLab Adapter 和自动里程碑规划。已追踪为 [Issues #1–#5](https://github.com/gmij/dsh-vscode/issues)。

## 本地运行扩展（开发模式）

1. 安装 Node.js 22、Git、[GitHub CLI](https://cli.github.com/) 和 VS Code。
2. 运行 `gh auth login`；需要实际可访问的测试仓库。
3. 在扩展仓库运行 `npm run check && npm test`。
4. 用 VS Code 打开本仓库，按 `F5` 启动 Extension Development Host。
5. 在测试窗口的命令面板运行 `DSH Workspace: Setup Project`，选择已克隆的 GitHub 仓库目录，按提示绑定。
6. 运行 `DSH Workspace: Check Project` 检查实际读取状态。

## 架构分工

- `gmij/dsh-vscode`：交互与项目控制面。
- `gmij/dsh-actions-connectivity`：已验证的无头 DSH 与 GitHub Actions 执行面。
- 本阶段 **不包括 AHP/微信**。先打通本地 VS Code 与 GitHub 工作流。

详细接口契约见 [docs/architecture.md](docs/architecture.md)。

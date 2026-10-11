# DSH VS Code ↔ Actions 集成工作区

## 目标
将 [gmij/dsh-actions-connectivity](https://github.com/gmij/dsh-actions-connectivity) 作为真实测试工程加入当前 VS Code 工作区，而不是复制仓库中的 Agent 或 workflow。两个仓库保持各自独立的 Git 历史、Issues 和 Actions。

## 快速使用
```bash
git clone https://github.com/gmij/dsh-vscode.git
git clone https://github.com/gmij/dsh-actions-connectivity.git
code dsh-vscode/dsh-factory.code-workspace
```
如果两个仓库并非同级目录：先打开 dsh-vscode，在扩展开发窗口使用命令 **DSH Workspace: Attach Agent Execution Repository**，选择 dsh-actions-connectivity 的本地目录。该命令检查其 `git origin`，只有确认目标仓库一致才加入工作区。

## 集成验收路线
1. 打开扩展仓库并运行 `npm test`；按 F5 启动 Extension Development Host。
2. 在 Extension Development Host 运行 Setup Project，把目标项目绑定到 dsh-actions-connectivity 的本地目录与 GitHub 仓库；运行 Check Project。
3. 用 View Agent Workflow 打开真实 issue-agent Actions 页面。
4. 通过 Run Existing Agent Workflow **人工确认**后运行连接性 smoke test，查看 GitHub Actions 运行日志。
5. 后续引入 DSH 聊天桥接、Discussion 写入时，以这个测试仓库为第一条端到端用例。

## 重要区别
- `Run Existing Agent Workflow` 目前只调用 `run-agent.yml` 的 `connectivity` agent，不会自动把本仓库的 Issue 同步至执行仓库。
- 两个仓库尚未通过跨仓库工作流自动调度；如以后要由 dsh-vscode 的 Milestone 指派执行，则需要建立 workflow inputs、授权、幂等映射和状态回写协议。
- 测试仓库现有的核心工作流包括 `run-agent.yml`、`issue-agent.yml`、`design-wiki.yml` 和 `prototype-pages.yml`。
- 不要在工具里硬编码 token；使用本地 `gh auth login`，CI 端用短期最小权限 token。
- **后续模型会话接入仍待实现**；目前此集成仅证明本地工作区和现有 Actions 能联动。

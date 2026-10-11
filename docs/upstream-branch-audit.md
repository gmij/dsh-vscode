# DSH 执行仓库分支审计（2026-10-11）

源仓库：[`gmij/dsh-actions-connectivity`](https://github.com/gmij/dsh-actions-connectivity)

## 逐分支对照

基准：`main` @ `10831645447f1aecd8b3689ad6e73fa2916e5f5e`（2026-10-11 09:59:47 UTC）。

| 分支 | 对应 PR | 比 main 多的提交 | 比 main 落后 | PR 文件变更 |
|---|---:|---:|---:|---:|
| copilot/connectivity-dropdown-issue-resolution | #5 | 1 | 159 | 0 |
| copilot/gmij-dsh-actions-connectivity-6-dropdown-reviewer | #7 | 1 | 159 | 0 |
| copilot/gmij-dsh-actions-connectivity-8 | #9 | 1 | 157 | 0 |
| copilot/add-weekly-reading-plan-prototype | #11 | 1 | 145 | 0 |
| copilot/analyze-backend-retry-strategy | #13 | 1 | 145 | 0 |
| copilot/generate-weekly-reading-plan-prototype | #15 | 1 | 139 | 0 |
| copilot/detailed-design-task-input-output | #18 | 1 | 94 | 0 |
| copilot/design-multi-vendor-title-sync | #19 | 1 | 92 | 0 |

所有 8 个 PR 通过 GitHub Changed Files API 核对为 **0 个变更文件**。这些分支多出的提交为 Copilot 调度/初始计划一类的历史记录，没有待合入的源码变更，**无需也不应按时间机械合并**；其执行结论和原型/设计在 Issues、Actions Artifacts、Pages、Wiki 中。

`prototype-previews` 为生成的原型静态发布分支，和 main 无共同祖先，属于部署数据，禁止合并到源代码主分支。

## 已实际实施

- `dsh-vscode/.github/workflows/dsh-issue-agent.yml` 使用从源仓库 `main` 验证的提交 SHA `10831645447f1aecd8b3689ad6e73fa2916e5f5e`，不再在执行时无固定版本地抓取 latest main。
- 将源仓库可信 `agents/` 与 `scripts/` 注入当前目标仓库 Actions 工作目录（保持目标项目自己的 Issue 和源码为上下文）。
- 已将原生 `.github/agents/*.agent.md` 和 `scripts/dsh_dispatch_mcp.py` 引入目标仓库，并将 API 目标改为 `gmij/dsh-vscode`，workflow 名称改为 `dsh-issue-agent.yml`。

## 需要继续迁移或适配的能力

1. 将 `prototype-pages.yml` 与 `design-wiki.yml` 依目标仓库实际权限、Pages/Wiki 状态适配；仅复制工作流不足以保证链接可用。
2. 将 `prototype_output.py`、`design_output.py`、`design_delivery.py` 的产物校验继续作为受信任的验收门禁。
3. 保证设计及原型的页面截图、独立 API 契约、前后端字段映射不会因跨仓库迁移缺失。
4. 在新的 DSH-VSCode 仓库配置专属 Agents Secret `COPILOT_MCP_DSH_DISPATCH_TOKEN`，并实际验证 Assign to Agent → MCP → workflow_dispatch → DSH → Issue。
5. 为仓库专用 Developer / Tester 角色另行设计受限写权限、PR、CI 和合并门禁；当前上游设计 Agent 不具备代码写入能力。

## 校验原则

仅依靠时间戳不能决定分支是否应合并。应先检查共同祖先、ahead/behind、提交内容、变更文件、CI 和目标分支所含功能。空 PR 不制造无意义 merge commit。源仓库历史保留，未经核实不删除分支或 PR。

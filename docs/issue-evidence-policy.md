## DSH 任务进度回写及验收规则（2026-10-14 生效）

**要求：DSH Issue Agent 的每次已完成运行必须自动把执行证据回写到原 Issue，而不是只上传 Artifact 或发布 Wiki / Pages。**

- 新增 `.github/workflows/dsh-issue-evidence.yml`，监听 `Issue DSH agent` 工作流结束；`scripts/issue_evidence_gate.py` 验证来源仓库、可信工作流、已完成状态、Issue 编号、route 成功、相关作业状态与实际 Artifact。
- 使用 `<!-- dsh-evidence-gate:run-<run_id> -->` 幂等标记；同一 Run 重试不能重复创建评论；已有设计结果评论、Wiki/Pages 链接继续由各自发布工作流维护。
- 自动回写要求分清：工作流/设计/原型/VSIX 构建成功，仅代表相应产出存在；**不得推断原生 ACP 连续对话、工具调用、桌面 UI、项目上下文隔离或客户验收已完成。**
- 同时记录 Issue 当前**未勾选验收项**。无法证明通过的项目保留未完成，缺少凭据/权限/运行环境写为 blocker；不可使用 mock 截图或绿灯替代真实测试证据。
- 不自动勾选、不自动关闭 Issue；只有全部验收项有对应日志/截图/测试/PR 和人工确认时，才进入关闭流程。
- Issue 进度评论中的每项实现、未完成项、依赖必须有具体文件、PR、Run 或 Artifact 可追溯，不能只写“成功/完成”。
- 源码变更和 VSIX 打包仍由现有 CI 负责；部署器/编排器的后续改造要遵循相同证据门禁。

## M0.1 验证记录

历史成功 Run [38188700247](https://github.com/gmij/dsh-vscode/actions/runs/38188700247) 已通过证据门禁回填 [Issue #1](https://github.com/gmij/dsh-vscode/issues/1#issuecomment-6156641676)。报告确认设计/原型/截图 Artifact 存在，但没有将功能验收自动标记完成；Issue #1 仍为 Open。其真实 ACP `initialize`、`session/new`、`session/list` / `session/resume` 已有部分实测，但持续模型调用因 Copilot Requests 403，真实工具调用与完整桌面操作仍未通过。

**后续完善：** 对失败/取消 Run 也回写具体错误与阻断；实现逐验收项精确证据映射，并考虑将 UI/测试验收状态写入机器可读的 contract，使正式开发 Agent 的 PR 合并、工作流回写保持一致。
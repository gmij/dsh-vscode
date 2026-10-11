# DSH VS Code 工作台架构与验收

## 当前阶段 M0
- **Agent Runtime:** DeepSeek Harness (`@deepseek-ai/dsh`)，不可混同 Nous Research Hermes。
- **控制面:** VS Code 扩展，项目绑定、讨论、任务和里程碑规划。
- **执行面:** 复用 `gmij/dsh-actions-connectivity` 的 GitHub Actions 无头 DSH。
- **远程事实来源:** GitHub；GitLab Adapter 在后续阶段实施。

## 主要实体
- Project: projectId, provider, repository, workspacePath, defaultBranch
- SessionBinding: projectId, providerSessionId, workspaceId
- DiscussionMapping: projectId, sessionId, topicId, discussionId, lastSyncedEventId
- MilestonePlan: milestoneNumber, approvalState, linkedIssues, acceptanceCriteria

## 工作流
对话 → 审批摘要 → Discussion → 决策确认 → Issue + Sub-issues + Milestone → 需求/概要/详细设计 → 原型评审 → 无头 DSH → PR/CI → 集成测试 → 发布。

## M0 验收
1. DSH 在 VS Code 内提供连续会话（需真实联调）。
2. VS Code 选择本地 Git 目录与 GitHub 仓库；验证 origin 和远程访问。
3. 重启 VS Code 后恢复 Project 绑定。
4. 读取远端 Issues、Milestones、Discussions。
5. 人工批准后幂等创建/更新 Discussions。

## 质量约束
- M0 默认只读，远程写入必须明确批准。
- 不将 OAuth token 或 API key 保存到项目仓库。
- 不能以“编译通过”替代端到端交互验收。
- 设计阶段必须明确页面/原型、API 契约、数据模型、请求/响应/错误及端到端测试。
- AHP/微信多端同步不在 M0 范围。

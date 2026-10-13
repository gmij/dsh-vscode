# TASK-01 · DSH 原生协议证据与门禁状态

> 审核日期：2026-10-13。状态：**blocked（未完成真实客户端集成测试）**。本文件仅记录已核实的官方文档与本仓库事实，不代表功能实现。

## 1. 本仓库与版本基线

- 目标仓库：`gmij/dsh-vscode`，VS Code 扩展 `0.1.0`，`engines.vscode=^1.95.0`。
- 成功的概要设计 Run：[`38188700247`](https://github.com/gmij/dsh-vscode/actions/runs/38188700247)；**该成功仅证明设计生成链路，不证明真实 VS Code 会话功能**。
- 本仓库工作流在 Agent 阶段安装 `@deepseek-ai/dsh@0.2.1-alpha.2`。这证明**CI 设计 Agent 的运行依赖版本**，不是未来 VS Code 客户端已选择、已锁定或已测试的版本。
- 当前 `package.json` 未声明 `@deepseek-ai/dsh` 客户端依赖；`src/extension.js` 尚未实现真实持续会话。
- 原型使用离线模拟数据，不能充当协议实测记录。

## 2. 官方协议资料（文档已核实，版本对齐尚未完成）

来源：[DeepSeek Harness 仓库 ACP 包 README](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/acp/acp/README.md)，[DSH npm 包说明](https://www.npmjs.com/package/@deepseek-ai/dsh)。

上游**当前默认分支的文档**明确提供 `dsh --profile acp`，JSON-RPC stdio，以及以下公开方法：

| 关键能力 | 默认分支文档 | 本地 VS Code 实测 |
|---|---|---|
| ACP 初始化与 `session/new` | 支持 | 未验证 |
| 同一会话连续 `session/prompt` | 支持 | 未验证 |
| `session/list`、`session/resume`、`session/close` | 支持，恢复不回放旧更新 | 未验证 |
| `session/update` 泛化工具生命周期 | 支持，非完整 DSH 专有 UI 事件 | 未验证 |
| `session/request_permission` | 支持，客户端需实现安全授权逻辑 | 未验证 |
| 显式绝对 `cwd` 项目上下文 | `session/new` 校验 | 未验证 |
| `session/cancel` | 支持 | 未验证 |
| DSH 专有计划、标题、完整 transcript 回放、编辑器导航 | ACP 不承诺 | 未验证，不能声称支持 |

**版本一致性警告**：上表来自当前上游默认分支，**不能自动外推**到本仓库 Actions 安装的 `0.2.1-alpha.2` 或未来锁定版本；必须将源码/文档与目标安装包具体版本或 commit 对齐，记录 npm integrity 值。

## 3. 拟选与验收路径

**优先候选：官方 DSH ACP stdio**，理由是当前官方资料已经明确公开新建、连续提示、列出及恢复会话、通用工具更新和授权消息。该选择仍是**候选，不是已经验收的唯一正式实现路径**。

TASK-01 必须在隔离目录内，使用同一份带版本与完整性信息的真实安装，保存脱敏测试记录：

1. 记录 `packageVersion`、integrity、DSH profile 的实际帮助输出，核对官方来源与所装包版本。
2. ACP `initialize`、`session/new`（带绝对 `cwd`），对同一 session 连续 `session/prompt` 两次，核验关联的 session ID。
3. 使用真实只读工具触发 `session/update`，核验 `toolCallId`、权限选择及实际结果，拒绝用模拟日志代替。
4. 关闭客户端进程，重新启动同一 profile、相同持久化根目录，用 `session/list` 和 `session/resume` 恢复同一原生会话；确认不静默新建会话。
5. 校验 VS Code workspace identity / Git repo / 当前 branch、项目切换拒绝跨项目恢复及密钥脱敏。
6. 输出 `ProtocolEvidenceV1`、原生方法到 IPC-01…IPC-08 的精确映射和异常矩阵；失败项目标注 unsupported 或 unknown。

**门禁：`gateStatus=blocked`。** 只有以上各项在**相同锁定版本**下实测通过，才能标为 `passed` 并解除 TASK-02 的实施门禁。

## 4. Wiki / Pages 发布现状

- 本仓库现有 `.github/workflows/dsh-issue-agent.yml` 的 `publish` 作业只回写 Issue，`capture` 只上传原型截图；未配置向本仓库 Wiki 或 GitHub Pages 发布产物的工作流。
- 交付包中的 `modules/MOD-01.md`、`modules/MOD-02.md` 有 12 处相对路径错误（根目录文档被错误当作模块目录文件）。
- 上游发布器的导航源代码已在 [PR #34](https://github.com/gmij/dsh-actions-connectivity/pull/34) 修复模块相对路径及 Wiki 侧栏 IPC 入口，**但已有的历史 Artifact 不会被自动改写**。
- Wiki/Pages 在目标仓库中的真实 URL、发布权限、导航可达性和前端可交互效果仍需独立部署与逐页访问验收，不能以上游仓库发布成功替代。

## 5. 决策

- **概要设计**：保留成功运行 `38188700247` 作为基线，不重复生成。
- **TASK-01**：官方协议路径有文档依据，但缺少锁定版本、完整性和真实桌面实测，当前不可关闭。
- **Wiki/Pages**：设计文档链接修复已合并到上游生成器，但当前下游仓库尚未具备独立发布闭环，导航交付尚不可签收。

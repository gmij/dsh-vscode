# M1 preview.2 · 验收与回滚矩阵

实现范围：#21，关联 #11/#14/#15；版本 0.4.0-preview.2。正式 v0.4 / v0.5 和 M1 保持 open。

## 已实现并验证的代码路径

- Activity Bar view 明确 type=webview；原 Chat via Real ACP 命令复用侧栏，共享单一 Controller/ACPClient。
- [严格 IPC 与逐通道契约](contracts/README.md)、请求去重、unknown 防重放、旧 generation 回调隔离、会话归属、取消和默认拒绝审批。
- DOM-only Markdown 子集：段落、一级到三级标题、粗体、行内代码、代码围栏和复制；不执行 HTML、不加载外部 URL/图片。支持键盘发送和 ARIA live，工具状态事件、会话新建/列举/恢复和配置入口。
- 项目 profile 优先解析整项配置；tracked/symlink 配置保护继续复用既有模块。权限卡不提供长期授权；只呈现有限元数据，不发送 rawInput 或任意事件对象。
- 测试为 Node 单测、DOM harness 和 Node fixture 子进程。它们不等同于真实浏览器、实际 VS Code 或真实 DSH Provider 验收。

## 尚未通过的门禁

| 门禁 | 状态/原因 | 通过条件 |
|---|---|---|
| 锁定 DSH 版本和基础协议 | 部分通过；0.2.1-alpha.2 真实进程 initialize/new/重启 list/resume 及 integrity 已留证 | 仍须真实 prompt 和权限语义 |
| 真实 Provider 两轮连续对话 | blocked；无用户本机配置和合法模型凭据 | 脱敏事件，两个 prompt 的相同 sessionId 与上下文连续回复 |
| 真实只读工具批准/拒绝 | blocked；fixture 仅测传输 | 批准后工具执行并显示结果；拒绝不执行 |
| 桌面重启恢复同 ID | blocked；无桌面 VS Code | 重启前后 sessionId 一致，项目切换不串会话 |
| 同一会话原生模型切换 | 协议层通过；已实现并验证 session/set_config_option，使用声明的测试模型、未发送 prompt | 合法 Provider 的两种实际模型回复及桌面 UI 留证 |
| Windows/macOS/Linux 安装与 320px 窄栏/屏幕阅读器 | blocked；无桌面环境 | 各平台安装截图、键盘焦点和无障碍记录 |
| 原生 Assign to Agent → MCP → Engine 自动开发/审查链路 | 未在本修复中复测 | 按 NATIVE-AGENTS 基线留存原生指派及 DSH 结果；本次可信开发 PR 不算该链路证据 |

## 桌面步骤与预期

1. 安装新 VSIX，Reload Window；Activity Bar 有 DSH Workspace，Chat 与设置入口可打开。
2. 绑定 Git 项目，加载 `.dsh/ai-profiles.json`；含 Key 的文件须未跟踪。连接后记 sessionId。
3. 连续发送两轮，确认分片合并、Markdown 和代码复制；同一个 sessionId。
4. 触发只读工具：先拒绝、再允许一次，观察工具状态与结果；未知/过期票据不授权。
5. 长任务点击停止：等待原生终态；超时必须显示 unknown、阻止重发；断开才可再确认连接。
6. 新建会话经确认；会话列表只显示当前配置拥有的 ID；切换模型清晰提示隔离，不共享旧历史。
7. 重启 VS Code，再连接恢复同一 v3 sessionId；修改 endpoint 后不得自动恢复旧 endpoint 会话。
8. 检查日志、Artifact、Git 状态和 VSIX，不得有真实 Key。

## 发布与回滚

PR 构建只发布 preview；CI/打包成功不能关闭 M1。GitHub Actions VSIX Package 输出 VSIX 和 SHA-256。回滚安装此前 preview.1 或 0.3.1，v3 与 v2 store 独立，旧数据不覆盖。v2 没有 endpoint/protocol 身份，不自动迁移，升级首次使用新 v3 会话。若需要旧 ID，须先核实对应端点与归属，不能自动跨模型恢复。

真实 DSH 基础协议记录见 [acp-preview-2.json](evidence/acp-preview-2.json)。安装只用于隔离协议探测，不读取用户凭据；测试模型配置使用未调用的 fixture Key，无实际模型调用。

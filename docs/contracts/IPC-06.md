# IPC-06 · 列举和恢复会话

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`listSessions / resume`；载荷例：`{"sessionId":"原生ID"}`。

字段：listSessions payload={}；resume.sessionId 必填 string 长度 1–256。

ACP 映射：session/list / session/resume。

状态/错误行为：Host 过滤至当前 v3 配置已记录的 owned ID，再用 QuickPick 选择。不是任意 DSH_HOME 会话均可恢复。恢复期间 busy，旧进程响应不得变更当前会话。原生恢复不回放历史文本，UI 明示。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

# IPC-01 · 连接/新建

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`connect`；载荷例：`{"resume":true}`。

字段：resume 可选 boolean，默认 true。false 先由 Host 确认，再创建新会话。

ACP 映射：initialize → session/new 或 session/resume。

状态/错误行为：连接中的请求互斥；断开使待完成初始化失效；返回 {sessionId}，推送 connected。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

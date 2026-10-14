# IPC-05 · 取消

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`cancel`；载荷例：`{}`。

字段：payload 严格为空对象。

ACP 映射：session/cancel 单向通知。

状态/错误行为：先拒绝所有未决权限票据；向原生 session 发送无 id 的通知。UI 保持正在取消，直到原生 prompt 终态；若超时则 unknown，不将点击停止本身算作确认取消。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

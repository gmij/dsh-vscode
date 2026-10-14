# IPC-02 · 发送提示

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`prompt`；载荷例：`{"text":"你好"}`。

字段：text 必填 string，去空白后非空且长度 ≤16000。

ACP 映射：session/prompt。

状态/错误行为：busy 或 unknown 拒绝。生成 turnId；成功推送 turnComplete，只返回 stopReason 投影。超时/错误进入 unknown、拒绝后续 prompt，须显式断开后确认再恢复；绝不自动重发。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

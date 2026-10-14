# IPC-08 · 状态和断开

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`status / disconnect`；载荷例：`{}`。

字段：payload 严格为空对象。status={connected,busy,unknown,sessionId,model,profile,turnId}，不含密钥。

ACP 映射：Host 本地状态，无 HTTP。

状态/错误行为：status 也推送 snapshot，重开 Webview 恢复 Host 状态。disconnect 清理票据、终止进程、递增 generation；旧 prompt 的 finally 不得清除新 turn 的 busy。process/exit 推送 connectionLost，需显式断开重连。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

# IPC-07 · 切换站点/模型

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`selectProfile`；载荷例：`{}`。

字段：payload 严格为空对象；选择只来自可信 Host 配置清单。

ACP 映射：关闭旧进程 → initialize → new/resume。

状态/错误行为：busy/unknown 时拒绝切换；用户取消 QuickPick 不重连。明确告知新建/恢复隔离会话；同一 session/set_config_option 模型切换仍待锁定 DSH 版本实测，不宣称已实现。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

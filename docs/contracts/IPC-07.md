# IPC-07 · 切换站点/模型

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`selectProfile`；载荷例：`{}`。

字段：payload 严格为空对象；选择只来自可信 Host 配置清单。

ACP 映射：同站点且端点/协议/凭据相同、模型已被原生公布：session/set_config_option；其余关闭旧进程 → initialize → new/resume。

状态/错误行为：busy/unknown 时拒绝切换；用户取消 QuickPick 不重连。同站点原生切换保留 sessionId，确认返回 currentValue 后迁移该 ID 的模型归属；失败进入 unknown。跨站点/端点/协议/凭据变化时隔离新建或恢复。锁定 DSH 的真实进程配置切换已验证，模型实际回复仍需凭据验收。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

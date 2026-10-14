# IPC-04 · 权限申请与裁决

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`permissionRespond`；载荷例：`{"ticketId":"随机票据","optionId":null}`。

字段：ticketId 必填 string ≤80；optionId 必填 string ≤256 或 null。Host event=permission 的 payload={id,summary,options:[{optionId,name}]}。

ACP 映射：session/request_permission → JSON-RPC result.outcome。

状态/错误行为：只接受当前 session、当前 generation、活动 turn 的请求。票据一次性，60 秒过期默认拒绝；unknown/disconnect/cancel 清理全部票据。过滤 allow_always，最多 16 个选项。未知选择返回 cancelled。UI 关闭不是授权。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

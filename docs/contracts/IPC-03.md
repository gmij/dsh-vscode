# IPC-03 · 文本与工具生命周期

所属任务：#21；所有者：Extension Host WorkspaceACPController / IPCRouter；调用方：Chat Webview。

操作：`Host notification`；载荷例：`{}`。

字段：事件无 RPC response。文本 event=update，payload.update={sessionUpdate:"agent_message_chunk",content:{type:"text",text}}；文本分片最大 65536 字符。工具 event=tool，payload={toolCallId,title,status,text}；status=pending|in_progress|completed|failed。

ACP 映射：session/update。

状态/错误行为：仅当前活动 session 且 busy、非 unknown 时投影。忽略 thought/其他消息类型。工具输出文本截断至 8000 字符，工具标题至 500 字符并遮蔽已知密钥；UI 显示生命周期，模型文本以 DOM-only Markdown 子集渲染。

公共信封、去重、长度和安全错误规则见 [契约索引](README.md)。真实 Provider 验证状态见 [验收矩阵](../m1-preview-2-validation.md)。

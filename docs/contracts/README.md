# M1 preview.2 · Webview IPC 实施契约

关联 #21 / #14 / #15；补充冻结设计，不代表真实 Provider 或桌面验收通过。

请求严格为 `{version:1,requestId,type,payload}`。requestId 为 1–80 个 ASCII 字母、数字、下划线或连字符；总消息最大 20,000 字符。未知信封/载荷字段、非法类型、未知操作均拒绝。请求 ID 在同一 Webview 生命周期内只执行一次；最多 10,000 条，满后拒绝而非淘汰重放记录。

响应为 `{version:1,requestId,ok:true,data}` 或 `{version:1,requestId,ok:false,error:{code,message}}`。只发送已知安全的公开错误文案，不透传 Provider/系统诊断。UI 不对 prompt 自动重试。

事件严格由 Host 发出 `{version:1,event,streamId,sequence,sessionId,turnId,payload}`。sequence 在同一个 Controller 单调递增；streamId 是 Controller 随机标识，重绑项目时变化。UI 只接收所属 stream/session/turn 的更新，旧回调在 Host generation 校验时也被拒绝。

Host 持有 cwd、API Key、模型及会话所有权。UI 不传入 cwd 或凭据。站点/模型通过可信 Host QuickPick 选择；本版 selectProfile payload 为 {}，不是任意 UI 提供的 profileId。项目配置存在相同 profile ID 时，整项配置及密钥优先，SecretStorage 仅提供密钥回退。

| 通道 | 契约 |
|---|---|
| IPC-01 | [连接/新建](IPC-01.md) |
| IPC-02 | [发送提示](IPC-02.md) |
| IPC-03 | [文本/工具推送](IPC-03.md) |
| IPC-04 | [权限申请/裁决](IPC-04.md) |
| IPC-05 | [取消](IPC-05.md) |
| IPC-06 | [会话列表/恢复](IPC-06.md) |
| IPC-07 | [站点/模型切换](IPC-07.md) |
| IPC-08 | [状态/断开](IPC-08.md) |
| IPC-09/10 | [项目与站点设置](IPC-09-10.md) |

会话存储 v3 以规范化目录、仓库、站点 ID、HTTPS endpoint、协议及 model 的 SHA-256 为键，记录原生 session ID 及归属 ID 集合。v2 缺少 endpoint/protocol 归属，**不自动迁移**；升级首次创建 v3 会话，旧数据不覆盖。相同 v3 配置重启恢复同 ID；失败不静默新建。

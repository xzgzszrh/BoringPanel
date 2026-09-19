# Scry Agent 安全设计

## 强制执行链

```text
用户输入/附件
  -> Prompt Injection 扫描
  -> 运维意图分类
  -> allow / require-approval / deny
  -> Agent 与系统安全 Loop
  -> 工具调用前命令复检
  -> 审批与参数哈希绑定
  -> MCP / scry-ops 包装器
  -> 结果验证
  -> 统一审计
```

安全 Loop 提供可视化和流程编排，底层策略引擎提供不可绕过的最终裁决。自定义 Loop 即使不包含 `security-check` 节点，聊天输入和 SSH/MCP 工具仍然执行强制检查。

## 信任边界

- 用户消息、附件、远程 MCP 输出、查询结果和 SSH 输出均视为不可信数据。
- 模型不拥有独立凭证，领域 API 始终使用当前用户 JWT。
- 外部 MCP 插件不会获得 Scry JWT，只使用管理员单独配置并加密保存的请求头。
- SSH 只能连接 `scry-ops` 公钥账户；Agent 容器无 Docker Socket、无 Linux capabilities、只读根文件系统。

## 审计与隐私

安全事件保存 traceId、组织、用户、事件类型、目标、裁决、风险分、输入 SHA-256 和结构化摘要。模型 Key、MCP 认证头、SSH 私钥、完整 Prompt 和完整命令输出不写入安全审计。SSH 专项审计另保存退出码、耗时和输出字节数，用于执行结果核验。

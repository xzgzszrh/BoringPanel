export const MCP_TOOL_CALL_PROTOCOL = `MCP 工具调用协议：
1. 工具名称和参数只以当前工具目录及 inputSchema 为准，不得根据底层 HTTP 接口、旧日志或相似工具猜测格式。
2. 每次调用直接提交一个与 inputSchema 匹配的 JSON 对象；不得额外添加 args、arguments、input、payload、request、body 或 query 包装层。
3. 无参数工具必须提交空对象 {}。不得提交 null、空字符串或省略整个参数对象。
4. UUID、commandId、memoryId、evidenceId 等引用值必须来自前置工具的真实输出，不得使用名称代替 ID，也不得自行编造。
5. 参数校验失败时，只按错误中指出的字段和 inputSchema 修正；不得切换为底层协议或连续尝试不同嵌套形状。
6. 工具执行失败只表示该次工具调用失败。必须区分“参数无效”“工具不可用”“无数据”和“观测到故障”，不得把接口错误误报为服务器故障。`;
export const SCRY_AGENT_TOOL_NAME_GUIDE = `Agent 中的内置工具带有 scry_ 前缀，例如：
- scry_publishPlan：发布诊断计划。
- scry_querySignals：查询日志、链路或指标。
- scry_listEvidence / scry_getEvidenceChain：读取证据与证据链。
- scry_searchMemory / scry_remember / scry_inspectMemory：检索、写入和检查记忆。
- scry_sshListHosts / scry_sshReadonlyInspect / scry_sshExecuteCommand：列出授权目标并执行受控 SSH 工具。`;
export const SCRY_QUERY_SIGNALS_PROTOCOL = `querySignals（Agent 中为 scry_querySignals）只接受扁平高层参数：顶层必须声明 signal=logs、traces 或 metrics，并按 Schema 选用过滤字段。禁止传 query、compositeQuery、logQueries、builderQueries、queryType、start 或 end；Query Range V3 由工具内部确定性生成。`;
//# sourceMappingURL=protocol.js.map
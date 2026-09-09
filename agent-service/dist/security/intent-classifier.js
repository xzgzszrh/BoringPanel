const PRIVILEGE = /(?:sudo\s+(?:su|bash|sh)|\bsu\s+-?|root\s+(?:shell|权限|账户)|提权|越权|管理员权限)/i;
const SECRET = /(?:api[_ -]?key|private[_ -]?key|password|credential|token|密钥|私钥|密码|凭证).{0,20}(?:show|read|print|dump|查看|读取|输出|导出)/i;
const CHANGE = /(?:restart|reload|stop|start|kill|delete|remove|clean|truncate|install|upgrade|modify|write|重启|重载|停止|启动|终止|删除|清理|安装|升级|修改|写入)/i;
const DIAGNOSE = /(?:root cause|diagnos|why|failure|error|latency|异常|故障|根因|诊断|为什么|错误|延迟)/i;
const OBSERVE = /(?:show|list|query|inspect|check|status|usage|查看|列出|查询|巡检|检查|状态|使用率)/i;
export function classifyIntent(text) {
    if (PRIVILEGE.test(text))
        return { intent: 'privilege-escalation', confidence: 0.98, requestedChange: true, reasons: ['请求包含权限提升或 root Shell 意图'] };
    if (SECRET.test(text))
        return { intent: 'secret-access', confidence: 0.95, requestedChange: false, reasons: ['请求尝试读取认证凭证或密钥'] };
    if (CHANGE.test(text))
        return { intent: 'change', confidence: 0.86, requestedChange: true, reasons: ['请求包含会改变系统状态的操作'] };
    if (DIAGNOSE.test(text))
        return { intent: 'diagnose', confidence: 0.82, requestedChange: false, reasons: ['请求目标是故障诊断或根因定位'] };
    if (OBSERVE.test(text))
        return { intent: 'observe', confidence: 0.8, requestedChange: false, reasons: ['请求目标是只读查询或巡检'] };
    return { intent: 'unknown', confidence: 0.45, requestedChange: false, reasons: ['没有匹配到明确的运维意图'] };
}
//# sourceMappingURL=intent-classifier.js.map
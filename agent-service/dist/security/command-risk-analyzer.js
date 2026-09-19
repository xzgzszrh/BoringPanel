const CONTROL_OPERATORS = /(?:^|[^\\])(?:;|&&|\|\||\||`|\$\(|>|<|\r|\n)/;
const FORBIDDEN_EXECUTABLES = new Set([
    'bash', 'sh', 'zsh', 'dash', 'fish', 'sudo', 'su', 'doas', 'env', 'eval', 'exec',
    'python', 'python3', 'perl', 'ruby', 'node', 'php', 'nc', 'ncat', 'socat',
]);
const DESTRUCTIVE = /(?:^|\s)(?:rm\s+-[^\n]*r[^\n]*f|mkfs(?:\.|\s)|wipefs|fdisk|parted|dd\s+if=|shutdown|poweroff|reboot|init\s+[06]|iptables\s+-F|nft\s+flush|user(?:add|del|mod)|passwd\b)/i;
function tokenize(command) {
    const tokens = [];
    let current = '';
    let quote = null;
    let escaped = false;
    for (const character of command.trim()) {
        if (escaped) {
            current += character;
            escaped = false;
            continue;
        }
        if (character === '\\' && quote !== 'single') {
            escaped = true;
            continue;
        }
        if (character === "'" && quote !== 'double') {
            quote = quote === 'single' ? null : 'single';
            continue;
        }
        if (character === '"' && quote !== 'single') {
            quote = quote === 'double' ? null : 'double';
            continue;
        }
        if (/\s/.test(character) && !quote) {
            if (current)
                tokens.push(current);
            current = '';
            continue;
        }
        current += character;
    }
    if (current)
        tokens.push(current);
    if (quote || escaped)
        return [];
    return tokens;
}
export function analyzeCommandRisk(command) {
    const reasons = [];
    const trimmed = command.trim();
    const tokens = tokenize(trimmed);
    const executable = (tokens[0] || '').split('/').pop()?.toLowerCase() || '';
    if (!trimmed || !tokens.length)
        reasons.push('命令为空或引号结构不完整');
    if (CONTROL_OPERATORS.test(trimmed))
        reasons.push('命令包含 Shell 控制、替换或重定向操作符');
    const safeSudoWrapper = executable === 'sudo'
        && tokens[1] === '-n'
        && /^\/opt\/scry-ops\/bin\/scry-[a-z0-9-]+$/.test(tokens[2] || '');
    if (FORBIDDEN_EXECUTABLES.has(executable) && !safeSudoWrapper)
        reasons.push(`禁止通过 ${executable || 'Shell'} 解释器或提权程序执行`);
    if (DESTRUCTIVE.test(trimmed))
        reasons.push('命令包含破坏性系统操作');
    if (tokens.some((token) => token.includes('\0')))
        reasons.push('命令包含空字节');
    if (reasons.length)
        return { decision: 'deny', riskScore: 100, executable, tokens, reasons };
    const wrapper = /^\/opt\/scry-ops\/bin\/scry-[a-z0-9-]+$/.test(tokens[0] || '') || safeSudoWrapper;
    if (wrapper)
        return { decision: 'require-approval', riskScore: 65, executable, tokens, reasons: ['调用受管 scry-ops 包装器，执行前必须审批'] };
    return { decision: 'deny', riskScore: 90, executable, tokens, reasons: ['命令没有调用受管 scry-ops 包装器'] };
}
//# sourceMappingURL=command-risk-analyzer.js.map
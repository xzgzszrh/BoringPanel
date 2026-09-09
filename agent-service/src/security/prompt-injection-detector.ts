import type { PromptInjectionFinding, PromptInjectionResult } from './types.js';

const RULES: Array<{
  id: string;
  pattern: RegExp;
  severity: PromptInjectionFinding['severity'];
  score: number;
  description: string;
}> = [
  { id: 'instruction-override', pattern: /(?:ignore|disregard|forget|override).{0,32}(?:previous|above|system|developer|instruction|rules?)|(?:忽略|无视|覆盖|忘记).{0,24}(?:之前|以上|系统|开发者|指令|规则)/i, severity: 'critical', score: 65, description: '尝试覆盖上位指令' },
  { id: 'prompt-exfiltration', pattern: /(?:reveal|show|print|repeat|leak).{0,36}(?:system prompt|developer message|hidden instruction|secret|api key)|(?:展示|输出|泄露|复述).{0,24}(?:系统提示|开发者消息|隐藏指令|密钥|凭证)/i, severity: 'high', score: 50, description: '尝试提取系统指令或凭证' },
  { id: 'safety-bypass', pattern: /(?:bypass|disable|evade).{0,30}(?:safety|policy|permission|approval|guardrail)|(?:绕过|关闭|规避).{0,24}(?:安全|策略|权限|审批|防护)/i, severity: 'critical', score: 60, description: '尝试绕过安全策略或审批' },
  { id: 'role-confusion', pattern: /(?:you are now|act as|pretend to be).{0,40}(?:system|developer|root|administrator)|(?:你现在是|扮演|假装).{0,30}(?:系统|开发者|root|管理员)/i, severity: 'medium', score: 30, description: '尝试改变 Agent 的授权角色' },
  { id: 'tool-output-instruction', pattern: /(?:tool output|attachment|retrieved content).{0,32}(?:instruction|command|must follow)|(?:工具输出|附件|检索内容).{0,24}(?:指令|命令|必须执行)/i, severity: 'medium', score: 30, description: '尝试将不可信数据提升为指令' },
  { id: 'encoded-payload', pattern: /(?:base64|hex|rot13).{0,24}(?:decode|execute|instruction|command)|(?:base64|十六进制).{0,24}(?:解码|执行|指令|命令)/i, severity: 'medium', score: 25, description: '包含要求解码执行的载荷' },
];

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectPromptInjection(text: string): PromptInjectionResult {
  const normalizedText = normalize(text).slice(0, 200_000);
  const findings = RULES.filter((rule) => rule.pattern.test(normalizedText)).map((rule) => ({
    id: rule.id,
    severity: rule.severity,
    score: rule.score,
    description: rule.description,
  }));
  const score = Math.min(100, findings.reduce((total, finding) => total + finding.score, 0));
  return { detected: score >= 50, score, normalizedText, findings };
}

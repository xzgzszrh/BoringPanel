import { agentApi, SecurityAuditEvent } from 'api/agent/client';
import { useNotifications } from 'hooks/useNotifications';
import {
	CheckCircle2,
	CircleAlert,
	Clock3,
	Loader2,
	RefreshCw,
	ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Props = { token: string };

function eventLabel(type: string): string {
	const labels: Record<string, string> = {
		'intent.received': '接收意图',
		'prompt_injection.scanned': '注入扫描',
		'intent.classified': '意图分类',
		'policy.allowed': '策略放行',
		'policy.denied': '策略拒绝',
		'policy.approval_required': '要求审批',
		'approval.requested': '发起审批',
		'approval.approved': '审批通过',
		'approval.denied': '审批拒绝',
		'approval.enforced': '审批绑定',
		'command.risk_evaluated': '命令复检',
		'tool.execution.started': '开始执行',
		'tool.execution.completed': '执行完成',
		'tool.execution.failed': '执行失败',
	};
	return labels[type] || type;
}

function decisionIcon(event: SecurityAuditEvent): JSX.Element {
	if (event.decision === 'deny') return <CircleAlert size={15} />;
	if (event.decision === 'require-approval') return <ShieldCheck size={15} />;
	if (event.decision === 'allow') return <CheckCircle2 size={15} />;
	return <Clock3 size={15} />;
}

export default function SecurityAuditTimeline({ token }: Props): JSX.Element {
	const { notifications } = useNotifications();
	const [events, setEvents] = useState<SecurityAuditEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const load = useCallback((): void => {
		if (!token) return;
		setLoading(true);
		agentApi
			.listSecurityAudits(token)
			.then(setEvents)
			.catch((error) => notifications.error({ message: error.message }))
			.finally(() => setLoading(false));
	}, [notifications, token]);
	useEffect(load, [load]);

	return (
		<section className="agent-settings-section security-audit-section">
			<div className="agent-section-title">
				<div>
					<h3>安全决策审计</h3>
					<p>意图、策略、审批和工具执行事件按 traceId 串联。</p>
				</div>
				<button
					type="button"
					className="security-audit-refresh"
					title="刷新"
					onClick={load}
				>
					<RefreshCw size={15} />
				</button>
			</div>
			{loading ? (
				<Loader2 className="agent-spin" size={18} />
			) : (
				<div className="security-audit-table" role="table">
					<div className="security-audit-row header" role="row">
						<span>时间</span>
						<span>事件</span>
						<span>来源 / 目标</span>
						<span>风险</span>
						<span>Trace</span>
					</div>
					{events.map((event) => (
						<div
							className={`security-audit-row ${event.decision || 'neutral'}`}
							role="row"
							key={event.id}
						>
							<time>
								{new Date(event.createdAt).toLocaleString('zh-CN', { hour12: false })}
							</time>
							<span className="security-event-name">
								{decisionIcon(event)}
								{eventLabel(event.eventType)}
							</span>
							<span title={event.target}>
								{event.source}
								{event.target ? ` / ${event.target}` : ''}
							</span>
							<span>{event.riskScore}</span>
							<code title={event.traceId}>{event.traceId.slice(0, 12)}</code>
						</div>
					))}
					{!events.length && (
						<span className="agent-field-hint">暂无安全决策事件。</span>
					)}
				</div>
			)}
		</section>
	);
}

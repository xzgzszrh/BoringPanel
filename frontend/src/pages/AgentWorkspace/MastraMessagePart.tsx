import { UIMessage } from 'ai';
import {
	AlertCircle,
	Bot,
	CheckCircle2,
	ChevronDown,
	Circle,
	FileText,
	GitBranch,
	Globe2,
	Loader2,
	Network,
	ShieldCheck,
	Wrench,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import A2UIRenderer from './A2UIRenderer';

export type MastraPart = UIMessage['parts'][number];

interface MastraMessagePartProps {
	part: MastraPart;
	partKey: string;
	onToolApproval: (runId: string, approved: boolean) => void;
	// eslint-disable-next-line react/no-unused-prop-types
	onWorkflowApproval: (runId: string, approved: boolean) => void;
}

const SSH_HOST_LIST_LABEL = '读取 SSH 主机列表';
const SSH_INSPECT_LABEL = 'SSH 只读巡检';
const SSH_COMMAND_LABEL = '执行 SSH 授权命令';
const TOOL_LABELS: Record<string, string> = {
	'publish-plan': '生成执行计划',
	publishPlan: '生成执行计划',
	'list-services': '读取服务列表',
	listServices: '读取服务列表',
	'list-alerts': '读取当前告警',
	listAlerts: '读取当前告警',
	'list-dashboards': '读取仪表盘',
	listDashboards: '读取仪表盘',
	'query-signals': '查询可观测性信号',
	querySignals: '查询可观测性信号',
	'ssh-list-hosts': SSH_HOST_LIST_LABEL,
	sshListHosts: SSH_HOST_LIST_LABEL,
	listHosts: SSH_HOST_LIST_LABEL,
	'ssh-readonly-inspect': SSH_INSPECT_LABEL,
	sshReadonlyInspect: SSH_INSPECT_LABEL,
	readonlyInspect: SSH_INSPECT_LABEL,
	'ssh-execute-command': SSH_COMMAND_LABEL,
	sshExecuteCommand: SSH_COMMAND_LABEL,
	executeConfiguredCommand: SSH_COMMAND_LABEL,
};
const OUTPUT_AVAILABLE = 'output-available';
const OUTPUT_ERROR = 'output-error';

export function partRecord(part: MastraPart): Record<string, unknown> {
	return (part as unknown) as Record<string, unknown>;
}

export function partData(part: MastraPart): Record<string, unknown> {
	const record = partRecord(part);
	return record.data && typeof record.data === 'object'
		? (record.data as Record<string, unknown>)
		: {};
}

export function isToolPart(part: MastraPart): boolean {
	return part.type.startsWith('tool-') || part.type === 'dynamic-tool';
}

export function toolName(part: MastraPart): string {
	const record = partRecord(part);
	const name = String(
		record.toolName || (part.type.startsWith('tool-') ? part.type.slice(5) : ''),
	);
	return TOOL_LABELS[name] || String(record.title || name || '工具调用');
}

function statusLabel(status: string): string {
	if (
		status === OUTPUT_AVAILABLE ||
		status === 'completed' ||
		status === 'success'
	)
		return '已完成';
	if (status === OUTPUT_ERROR || status === 'failed' || status === 'error')
		return '失败';
	if (status === 'cancelled' || status === 'canceled') return '已取消';
	if (status === 'approval-requested' || status.includes('approval'))
		return '等待审批';
	if (status === 'suspended') return '已暂停';
	return '执行中';
}

function statusIcon(status: string): JSX.Element {
	if (
		status === OUTPUT_AVAILABLE ||
		status === 'completed' ||
		status === 'success'
	)
		return <CheckCircle2 size={15} />;
	if (
		status === OUTPUT_ERROR ||
		status === 'failed' ||
		status === 'error' ||
		status === 'cancelled' ||
		status === 'canceled'
	)
		return <AlertCircle size={15} />;
	if (
		status === 'approval-requested' ||
		status === 'suspended' ||
		status.includes('approval')
	)
		return <ShieldCheck size={15} />;
	return <Loader2 className="agent-spin" size={15} />;
}

function jsonText(value: unknown): string {
	if (typeof value === 'string') return value;
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function recordValue(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object'
		? (value as Record<string, unknown>)
		: {};
}

function a2uiSurface(
	data: Record<string, unknown>,
): Record<string, unknown> | null {
	if (data.a2ui && typeof data.a2ui === 'object')
		return data.a2ui as Record<string, unknown>;
	return data.root ? data : null;
}

function findA2UISurface(
	value: unknown,
	depth = 0,
): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || depth > 5) return null;
	const record = value as Record<string, unknown>;
	const direct = a2uiSurface(record);
	if (direct) return direct;
	return Object.values(record).reduce<Record<string, unknown> | null>(
		(found, child) => found || findA2UISurface(child, depth + 1),
		null,
	);
}

function ToolPartView({
	part,
	partKey,
}: Pick<MastraMessagePartProps, 'part' | 'partKey'>): JSX.Element {
	const record = partRecord(part);
	const status = String(record.state || 'input-streaming');
	const { input } = record;
	const { output } = record;
	const outputSurface = findA2UISurface(output);
	return (
		<div className={`mastra-tool-part ${status}`} key={partKey}>
			<div className="mastra-part-heading">
				<span>{statusIcon(status)}</span>
				<div>
					<strong>{toolName(part)}</strong>
					<small>{statusLabel(status)}</small>
				</div>
			</div>
			{status === OUTPUT_ERROR && (
				<div className="mastra-part-error">
					{String(record.errorText || '工具执行失败')}
				</div>
			)}
			{outputSurface && <A2UIRenderer surface={outputSurface} />}
			{(input !== undefined || output !== undefined) && (
				<details>
					<summary>
						调用详情 <ChevronDown size={13} />
					</summary>
					{input !== undefined && (
						<section>
							<span>输入</span>
							<pre>{jsonText(input)}</pre>
						</section>
					)}
					{output !== undefined && (
						<section>
							<span>输出</span>
							<pre>{jsonText(output)}</pre>
						</section>
					)}
				</details>
			)}
		</div>
	);
}

function ApprovalPartView({
	part,
	partKey,
	onToolApproval,
}: Pick<
	MastraMessagePartProps,
	'part' | 'partKey' | 'onToolApproval'
>): JSX.Element {
	const data = partData(part);
	const runId = String(data.runId || '');
	return (
		<div className="mastra-approval-part" key={partKey}>
			<div className="mastra-part-heading">
				<span>
					<ShieldCheck size={15} />
				</span>
				<div>
					<strong>
						{TOOL_LABELS[String(data.toolName)] ||
							String(data.toolName || '高风险工具')}
					</strong>
					<small>等待人工审批</small>
				</div>
			</div>
			{data.args !== undefined && <pre>{jsonText(data.args)}</pre>}
			<div className="agent-approval-actions">
				<button type="button" onClick={(): void => onToolApproval(runId, false)}>
					拒绝
				</button>
				<button
					type="button"
					className="primary"
					onClick={(): void => onToolApproval(runId, true)}
				>
					批准并继续
				</button>
			</div>
		</div>
	);
}

function WorkflowPartView({
	part,
	partKey,
}: Pick<MastraMessagePartProps, 'part' | 'partKey'>): JSX.Element {
	const data = partData(part);
	const status = String(data.status || 'running');
	const steps =
		data.steps && typeof data.steps === 'object'
			? Object.entries(data.steps as Record<string, unknown>)
			: [];
	const completed = steps.filter(([, value]) => {
		const stepStatus = String(recordValue(value).status || '');
		return stepStatus === 'success' || stepStatus === 'completed';
	}).length;
	return (
		<div className={`mastra-workflow-part ${status}`} key={partKey}>
			<div className="mastra-part-heading">
				<span>{statusIcon(status)}</span>
				<div>
					<strong>{String(data.name || 'Loop 执行')}</strong>
					<small>
						{statusLabel(status)} · {completed}/{steps.length} 个节点
					</small>
				</div>
			</div>
			{steps.length > 0 && (
				<div className="mastra-workflow-progress" aria-hidden="true">
					<span
						style={{ width: `${Math.round((completed / steps.length) * 100)}%` }}
					/>
				</div>
			)}
			<div className="mastra-workflow-steps">
				{steps.map(([stepId, value]) => {
					const step = recordValue(value);
					const stepStatus = String(step.status || 'running');
					return (
						<details key={stepId}>
							<summary>
								<span>{statusIcon(stepStatus)}</span>
								<strong>{String(step.name || stepId)}</strong>
								<small>{statusLabel(stepStatus)}</small>
								<ChevronDown size={13} />
							</summary>
							{step.input !== null && step.input !== undefined && (
								<section>
									<span>输入</span>
									<pre>{jsonText(step.input)}</pre>
								</section>
							)}
							{step.output !== null && step.output !== undefined && (
								<section>
									<span>输出</span>
									<pre>{jsonText(step.output)}</pre>
								</section>
							)}
							{step.suspendPayload !== null && step.suspendPayload !== undefined && (
								<section>
									<span>暂停信息</span>
									<pre>{jsonText(step.suspendPayload)}</pre>
								</section>
							)}
						</details>
					);
				})}
			</div>
		</div>
	);
}

function NetworkPartView({
	part,
	partKey,
}: Pick<MastraMessagePartProps, 'part' | 'partKey'>): JSX.Element {
	const data = partData(part);
	const status = String(data.status || 'running');
	const steps = Array.isArray(data.steps) ? data.steps : [];
	return (
		<div
			className={`mastra-workflow-part mastra-network-part ${status}`}
			key={partKey}
		>
			<div className="mastra-part-heading">
				<span>
					<Network size={15} />
				</span>
				<div>
					<strong>{String(data.name || 'Agent 网络')}</strong>
					<small>
						{statusLabel(status)} · {steps.length} 次委派
					</small>
				</div>
			</div>
			{steps.length > 0 && (
				<div className="mastra-network-steps">
					{steps.map((value, index) => {
						const step = recordValue(value);
						const stepStatus = String(step.status || 'running');
						return (
							<div key={String(step.id || `${step.name || 'step'}-${index}`)}>
								<span>{statusIcon(stepStatus)}</span>
								<strong>{String(step.name || `执行单元 ${index + 1}`)}</strong>
								<small>{statusLabel(stepStatus)}</small>
							</div>
						);
					})}
				</div>
			)}
			{data.output !== null && data.output !== undefined && (
				<details>
					<summary>
						网络输出 <ChevronDown size={13} />
					</summary>
					<pre>{jsonText(data.output)}</pre>
				</details>
			)}
		</div>
	);
}

function AgentPartView({
	part,
	partKey,
}: Pick<MastraMessagePartProps, 'part' | 'partKey'>): JSX.Element {
	const data = partData(part);
	const steps = Array.isArray(data.steps) ? data.steps : [];
	const status = data.finishReason ? 'completed' : 'running';
	return (
		<details className="mastra-data-part mastra-agent-part" key={partKey}>
			<summary>
				<Bot size={13} />
				嵌套 Agent · {statusLabel(status)} · {steps.length} 个步骤
			</summary>
			<pre>{jsonText(data)}</pre>
		</details>
	);
}

// The renderer intentionally handles every AI SDK UI part variant in one protocol boundary.
// eslint-disable-next-line sonarjs/cognitive-complexity
export default function MastraMessagePart({
	part,
	partKey,
	onToolApproval,
	onWorkflowApproval,
}: MastraMessagePartProps): JSX.Element | null {
	if (part.type === 'text')
		return <ReactMarkdown key={partKey}>{part.text}</ReactMarkdown>;
	if (part.type === 'reasoning')
		return (
			<details className="agent-reasoning" key={partKey}>
				<summary>
					{part.state === 'streaming' ? '正在推理' : '查看推理过程'}
				</summary>
				<ReactMarkdown>{part.text}</ReactMarkdown>
			</details>
		);
	if (part.type === 'source-url')
		return (
			<a
				className="agent-source"
				href={part.url}
				target="_blank"
				rel="noreferrer"
				key={partKey}
			>
				<Globe2 size={13} />
				{part.title || part.url}
			</a>
		);
	if (part.type === 'source-document')
		return (
			<div className="agent-source" key={partKey}>
				<FileText size={13} />
				{part.title || part.filename || '文档来源'}
			</div>
		);
	if (part.type === 'file') {
		if (part.mediaType.startsWith('image/'))
			return (
				<img
					className="mastra-generated-image"
					src={part.url}
					alt={part.filename || '模型生成图片'}
					key={partKey}
				/>
			);
		return (
			<a
				className="mastra-file-part"
				href={part.url}
				target="_blank"
				rel="noreferrer"
				key={partKey}
			>
				<FileText size={15} />
				{part.filename || part.mediaType}
			</a>
		);
	}
	if (part.type === 'step-start')
		return (
			<div className="mastra-step-boundary" key={partKey}>
				<Circle size={7} />
				<span>新的模型步骤</span>
			</div>
		);
	if (isToolPart(part)) return <ToolPartView part={part} partKey={partKey} />;
	if (part.type === 'data-tool-call-approval')
		return (
			<ApprovalPartView
				part={part}
				partKey={partKey}
				onToolApproval={onToolApproval}
			/>
		);
	if (part.type === 'data-workflow' || part.type === 'data-tool-workflow')
		return <WorkflowPartView part={part} partKey={partKey} />;
	if (part.type === 'data-network' || part.type === 'data-tool-network')
		return <NetworkPartView part={part} partKey={partKey} />;
	if (part.type === 'data-tool-agent')
		return <AgentPartView part={part} partKey={partKey} />;
	if (part.type === 'data-tripwire') {
		const data = partData(part);
		return (
			<div className="mastra-status-part error" key={partKey}>
				<AlertCircle size={15} />
				<div>
					<strong>安全处理器已中止本次响应</strong>
					<span>{String(data.reason || data.message || '输出未通过安全检查')}</span>
				</div>
			</div>
		);
	}
	if (part.type === 'data-tool-call-suspended') {
		const data = partData(part);
		return (
			<div className="mastra-status-part suspended" key={partKey}>
				<ShieldCheck size={15} />
				<div>
					<strong>{String(data.toolName || '工具调用')} 已暂停</strong>
					<span>需要补充信息后才能继续执行</span>
					{data.suspendPayload !== undefined && (
						<pre>{jsonText(data.suspendPayload)}</pre>
					)}
				</div>
			</div>
		);
	}
	if (part.type.startsWith('data-')) {
		const data = partData(part);
		const surface = a2uiSurface(data);
		if (surface) return <A2UIRenderer key={partKey} surface={surface} />;
		if (
			part.type === 'data-workflow-step' ||
			part.type === 'data-tool-workflow-step' ||
			part.type === 'data-scry-workflow-step'
		)
			return (
				<details className="mastra-data-part mastra-step-part" key={partKey}>
					<summary>
						<GitBranch size={13} />
						{String(data.name || data.stepId || 'Loop 节点')} ·{' '}
						{statusLabel(String(data.status || 'running'))}
					</summary>
					<pre>{jsonText(data.step || data)}</pre>
					{part.type === 'data-scry-workflow-step' &&
						data.status === 'suspended' &&
						Boolean(data.runId) &&
						onWorkflowApproval && (
							<div className="agent-approval-actions">
								<button
									type="button"
									onClick={(): void => onWorkflowApproval(String(data.runId), false)}
								>
									拒绝
								</button>
								<button
									type="button"
									className="primary"
									onClick={(): void => onWorkflowApproval(String(data.runId), true)}
								>
									批准并继续
								</button>
							</div>
						)}
				</details>
			);
		return (
			<details className="mastra-data-part" key={partKey}>
				<summary>
					<Wrench size={13} />
					{part.type === 'data-structured-output' ? '结构化输出' : '结构化数据'}
				</summary>
				<pre>{jsonText(data)}</pre>
			</details>
		);
	}
	return null;
}

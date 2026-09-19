import { Input, Modal } from 'antd';
import {
	agentApi,
	EvidenceItem,
	EvidenceSourceType,
	EvidenceStatus,
} from 'api/agent/client';
import {
	Activity,
	Bell,
	Check,
	FileText,
	GitBranch,
	Globe2,
	LayoutDashboard,
	Loader2,
	MessageSquareText,
	Pause,
	Plug,
	RefreshCw,
	RotateCcw,
	Server,
	SquareTerminal,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface EvidenceInspectorProps {
	token: string;
	threadId: string;
	refreshKey: string;
	busy: boolean;
	onRevisionComplete: () => Promise<void>;
	onError: (message: string) => void;
}

const statusLabels: Record<EvidenceStatus, string> = {
	active: '有效',
	accepted: '已采纳',
	rejected: '已驳回',
	suspended: '已挂起',
};

const sourceLabels: Record<EvidenceSourceType, string> = {
	telemetry: '可观测信号',
	service: '服务',
	alert: '告警',
	dashboard: '仪表盘',
	ssh: '主机巡检',
	mcp: 'MCP 工具',
	workflow: 'Loop 分析',
	document: '文档',
	url: '网页来源',
};

function SourceIcon({ type }: { type: EvidenceSourceType }): JSX.Element {
	if (type === 'telemetry') return <Activity size={15} />;
	if (type === 'service') return <Server size={15} />;
	if (type === 'alert') return <Bell size={15} />;
	if (type === 'dashboard') return <LayoutDashboard size={15} />;
	if (type === 'ssh') return <SquareTerminal size={15} />;
	if (type === 'mcp') return <Plug size={15} />;
	if (type === 'workflow') return <GitBranch size={15} />;
	if (type === 'url') return <Globe2 size={15} />;
	return <FileText size={15} />;
}

function scoreClass(score: number): string {
	if (score >= 80) return 'high';
	if (score >= 60) return 'medium';
	return 'low';
}

function relationLabel(
	type: EvidenceItem['relations'][number]['type'],
): string {
	if (type === 'same_trace') return '同一执行链';
	if (type === 'corroborates') return '交叉印证';
	if (type === 'derived_from') return '由此派生';
	return '相关证据';
}

function actionLabel(action: string): string {
	const labels: Record<string, string> = {
		captured: '系统采集',
		auto_suspended: '安全扫描自动挂起',
		accepted: '人工采纳',
		rejected: '人工驳回',
		suspended: '人工挂起',
		restored: '恢复有效',
		selected: '选入重答',
		unselected: '移出重答',
		noted: '更新备注',
		used_for_revision: '用于修订回答',
	};
	return labels[action] || action;
}

function contentText(content: unknown): string {
	if (typeof content === 'string') return content;
	try {
		return JSON.stringify(content, null, 2);
	} catch {
		return String(content);
	}
}

export default function EvidenceInspector({
	token,
	threadId,
	refreshKey,
	busy,
	onRevisionComplete,
	onError,
}: EvidenceInspectorProps): JSX.Element {
	const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [updatingId, setUpdatingId] = useState('');
	const [filter, setFilter] = useState<'all' | EvidenceStatus>('all');
	const [noteTarget, setNoteTarget] = useState<EvidenceItem | null>(null);
	const [note, setNote] = useState('');
	const [instruction, setInstruction] = useState('');
	const [revising, setRevising] = useState(false);

	const load = useCallback(async (): Promise<void> => {
		if (!token || !threadId) {
			setEvidence([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			setEvidence(await agentApi.listEvidence(token, threadId));
		} catch (error) {
			onError(error instanceof Error ? error.message : '证据加载失败');
		} finally {
			setLoading(false);
		}
	}, [onError, threadId, token]);

	useEffect(() => {
		load();
	}, [load, refreshKey]);

	const visibleEvidence = useMemo(
		() => evidence.filter((item) => filter === 'all' || item.status === filter),
		[evidence, filter],
	);
	const selected = evidence.filter(
		(item) =>
			item.selected && item.status !== 'rejected' && item.status !== 'suspended',
	);
	const activeEvidence = evidence.filter(
		(item) => item.status !== 'rejected' && item.status !== 'suspended',
	);
	const averageConfidence = activeEvidence.length
		? Math.round(
				activeEvidence.reduce((total, item) => total + item.confidence, 0) /
					activeEvidence.length,
		  )
		: 0;

	const patchEvidence = async (
		item: EvidenceItem,
		patch: { status?: EvidenceStatus; selected?: boolean; note?: string },
	): Promise<void> => {
		setUpdatingId(item.id);
		try {
			const updated = await agentApi.updateEvidence(token, item.id, patch);
			setEvidence((current) =>
				current.map((candidate) =>
					candidate.id === updated.id ? updated : candidate,
				),
			);
		} catch (error) {
			onError(error instanceof Error ? error.message : '证据更新失败');
		} finally {
			setUpdatingId('');
		}
	};

	const openNote = (item: EvidenceItem): void => {
		setNoteTarget(item);
		setNote(item.note);
	};

	const saveNote = async (): Promise<void> => {
		if (!noteTarget) return;
		await patchEvidence(noteTarget, { note });
		setNoteTarget(null);
	};

	const revise = async (): Promise<void> => {
		if (!selected.length || revising || busy) return;
		setRevising(true);
		try {
			await agentApi.reviseWithEvidence(
				token,
				threadId,
				selected.map((item) => item.id),
				instruction.trim(),
			);
			setInstruction('');
			await onRevisionComplete();
			await load();
		} catch (error) {
			onError(error instanceof Error ? error.message : '基于证据重新回答失败');
		} finally {
			setRevising(false);
		}
	};

	if (loading)
		return (
			<div className="agent-inspector-empty">
				<Loader2 className="agent-spin" size={22} />
				<strong>正在整理证据</strong>
			</div>
		);

	return (
		<div className="evidence-inspector">
			<Modal
				open={Boolean(noteTarget)}
				title="证据备注"
				okText="保存"
				cancelText="取消"
				onOk={saveNote}
				onCancel={(): void => setNoteTarget(null)}
				confirmLoading={Boolean(updatingId)}
			>
				<Input.TextArea
					value={note}
					onChange={(event): void => setNote(event.target.value)}
					placeholder="记录人工判断、异常点或后续核验要求"
					maxLength={4000}
					rows={5}
				/>
			</Modal>

			<div className="evidence-summary">
				<div>
					<strong>{activeEvidence.length}</strong>
					<span>有效证据</span>
				</div>
				<div>
					<strong>{selected.length}</strong>
					<span>已选择</span>
				</div>
				<div>
					<strong>{averageConfidence}%</strong>
					<span>平均置信度</span>
				</div>
			</div>

			<div className="evidence-toolbar">
				<select
					value={filter}
					onChange={(event): void =>
						setFilter(event.target.value as 'all' | EvidenceStatus)
					}
					aria-label="筛选证据状态"
				>
					<option value="all">全部状态</option>
					<option value="active">有效</option>
					<option value="accepted">已采纳</option>
					<option value="rejected">已驳回</option>
					<option value="suspended">已挂起</option>
				</select>
				<button type="button" title="刷新证据" onClick={load}>
					<RefreshCw size={14} />
				</button>
			</div>

			<div className="evidence-list">
				{visibleEvidence.map((item) => {
					const disabled = item.status === 'rejected' || item.status === 'suspended';
					const related = item.relations.map((relation) => {
						const otherId =
							relation.fromEvidenceId === item.id
								? relation.toEvidenceId
								: relation.fromEvidenceId;
						return {
							...relation,
							other: evidence.find((candidate) => candidate.id === otherId),
						};
					});
					return (
						<article className={`evidence-item ${item.status}`} key={item.id}>
							<div className="evidence-item-top">
								<label className="evidence-select" title="选择用于重新回答">
									<input
										type="checkbox"
										checked={item.selected && !disabled}
										disabled={disabled || updatingId === item.id}
										onChange={(event): void => {
											patchEvidence(item, { selected: event.target.checked }).catch(
												() => undefined,
											);
										}}
									/>
									<span />
								</label>
								<div className="evidence-source-icon">
									<SourceIcon type={item.sourceType} />
								</div>
								<div className="evidence-item-title">
									<strong>{item.title}</strong>
									<span>
										{sourceLabels[item.sourceType]} · {item.id.slice(0, 8)}
									</span>
								</div>
								<span className={`evidence-status ${item.status}`}>
									{statusLabels[item.status]}
								</span>
							</div>

							<p>{item.summary}</p>
							<div className="evidence-scores">
								<div>
									<span>置信度</span>
									<div className="evidence-score-track">
										<i
											className={scoreClass(item.confidence)}
											style={{ width: `${item.confidence}%` }}
										/>
									</div>
									<strong>{item.confidence}%</strong>
								</div>
								<div>
									<span>关联度</span>
									<div className="evidence-score-track">
										<i
											className={scoreClass(item.relevance)}
											style={{ width: `${item.relevance}%` }}
										/>
									</div>
									<strong>{item.relevance}%</strong>
								</div>
							</div>

							{item.note && (
								<div className="evidence-note">
									<MessageSquareText size={12} /> {item.note}
								</div>
							)}

							<details className="evidence-detail">
								<summary>
									证据内容 · {related.length} 项关联 · {item.actions.length} 次处置
								</summary>
								<div className="evidence-chain-meta">
									<span>Trace {item.traceId.slice(0, 12)}</span>
									<time>{new Date(item.capturedAt).toLocaleString('zh-CN')}</time>
								</div>
								<pre>{contentText(item.content)}</pre>
								{related.length > 0 && (
									<div className="evidence-relations">
										{related.map((relation) => (
											<div key={relation.id}>
												<span>{relationLabel(relation.type)}</span>
												<strong>{relation.other?.title || '关联证据'}</strong>
												<small>{relation.score}%</small>
											</div>
										))}
									</div>
								)}
								{item.actions.length > 0 && (
									<div className="evidence-history">
										{[...item.actions]
											.reverse()
											.slice(0, 8)
											.map((action) => (
												<div key={action.id}>
													<i />
													<div>
														<strong>{actionLabel(action.action)}</strong>
														<time>{new Date(action.createdAt).toLocaleString('zh-CN')}</time>
														{action.note && <span>{action.note}</span>}
													</div>
												</div>
											))}
									</div>
								)}
							</details>

							<div className="evidence-actions">
								{item.status !== 'accepted' && !disabled && (
									<button
										type="button"
										title="采纳证据"
										onClick={(): void => {
											patchEvidence(item, { status: 'accepted' }).catch(() => undefined);
										}}
									>
										<Check size={14} />
									</button>
								)}
								{!disabled && (
									<>
										<button
											type="button"
											title="驳回证据"
											onClick={(): void => {
												patchEvidence(item, { status: 'rejected' }).catch(() => undefined);
											}}
										>
											<X size={14} />
										</button>
										<button
											type="button"
											title="挂起证据"
											onClick={(): void => {
												patchEvidence(item, { status: 'suspended' }).catch(() => undefined);
											}}
										>
											<Pause size={14} />
										</button>
									</>
								)}
								{disabled && (
									<button
										type="button"
										title="恢复为有效证据"
										onClick={(): void => {
											patchEvidence(item, { status: 'active' }).catch(() => undefined);
										}}
									>
										<RotateCcw size={14} />
									</button>
								)}
								<button
									type="button"
									title="添加备注"
									onClick={(): void => openNote(item)}
								>
									<MessageSquareText size={14} />
								</button>
								{updatingId === item.id && <Loader2 className="agent-spin" size={13} />}
							</div>
						</article>
					);
				})}
				{!visibleEvidence.length && (
					<div className="agent-inspector-empty compact">
						<FileText size={22} />
						<strong>暂无匹配证据</strong>
						<span>完成工具查询后，证据会自动进入这里。</span>
					</div>
				)}
			</div>

			<div className="evidence-revision-bar">
				<Input.TextArea
					value={instruction}
					onChange={(event): void => setInstruction(event.target.value)}
					placeholder="补充重答要求（可选）"
					maxLength={2000}
					autoSize={{ minRows: 1, maxRows: 3 }}
				/>
				<button
					type="button"
					disabled={!selected.length || revising || busy}
					onClick={revise}
				>
					{revising ? (
						<Loader2 className="agent-spin" size={14} />
					) : (
						<RefreshCw size={14} />
					)}
					基于 {selected.length} 项证据重答
				</button>
			</div>
		</div>
	);
}

import {
	agentApi,
	MemoryItem,
	MemoryRetrievalPacket,
	MemoryStatus,
} from 'api/agent/client';
import { Modal } from 'antd';
import {
	Archive,
	BrainCircuit,
	CheckCircle2,
	GitBranch,
	Loader2,
	PauseCircle,
	Pin,
	PinOff,
	RefreshCw,
	Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Props {
	token: string;
	threadId: string;
	refreshKey: string;
	busy: boolean;
	onError: (message: string) => void;
}

const typeLabels: Record<MemoryItem['type'], string> = {
	working: '工作记忆',
	episodic: '情景记忆',
	semantic: '语义记忆',
	procedural: '程序记忆',
};

const statusLabels: Record<MemoryStatus, string> = {
	active: '有效',
	verified: '已验证',
	suspended: '已挂起',
	archived: '已归档',
	forgotten: '已遗忘',
};

function scoreClass(value: number): string {
	if (value >= 75) return 'high';
	if (value >= 45) return 'medium';
	return 'low';
}

export default function MemoryInspector({
	token,
	threadId,
	refreshKey,
	busy,
	onError,
}: Props): JSX.Element {
	const [packet, setPacket] = useState<MemoryRetrievalPacket | null>(null);
	const [loading, setLoading] = useState(false);
	const [updating, setUpdating] = useState('');

	const load = useCallback(async (): Promise<void> => {
		if (!token || !threadId) {
			setPacket(null);
			return;
		}
		setLoading(true);
		try {
			setPacket(await agentApi.getThreadMemories(token, threadId));
		} catch (error) {
			onError(error instanceof Error ? error.message : '记忆检索失败');
		} finally {
			setLoading(false);
		}
	}, [onError, threadId, token]);

	useEffect(() => {
		load();
	}, [load, refreshKey]);

	const update = async (
		memory: MemoryItem,
		patch: { status?: MemoryStatus; pinned?: boolean },
	): Promise<void> => {
		setUpdating(memory.id);
		try {
			await agentApi.updateMemory(token, memory.id, patch);
			await load();
		} catch (error) {
			onError(error instanceof Error ? error.message : '记忆更新失败');
		} finally {
			setUpdating('');
		}
	};

	const forget = (memory: MemoryItem): void => {
		Modal.confirm({
			title: '遗忘这项记忆？',
			content: '正文、摘要、标签、关键词和服务标识将被清除，只保留审计骨架。',
			okText: '确认遗忘',
			okButtonProps: { danger: true },
			cancelText: '取消',
			onOk: async () => {
				setUpdating(memory.id);
				try {
					await agentApi.forgetMemory(token, memory.id);
					await load();
				} finally {
					setUpdating('');
				}
			},
		});
	};

	if (!threadId) {
		return (
			<div className="agent-inspector-empty compact">
				<BrainCircuit size={24} />
				<strong>尚未选择对话</strong>
				<span>选择对话后显示与当前问题相关的运行记忆。</span>
			</div>
		);
	}

	return (
		<div className="memory-inspector">
			<div className="memory-retrieval-head">
				<div>
					<strong>{packet?.strategy || '等待检索'}</strong>
					<span>{packet ? `${packet.latencyMs} ms · ${packet.results.length} 项` : 'TopoMem'}</span>
				</div>
				<button type="button" onClick={load} disabled={loading || busy} title="重新检索">
					{loading ? <Loader2 className="agent-spin" size={14} /> : <RefreshCw size={14} />}
				</button>
			</div>

			{packet?.paths.length ? (
				<div className="memory-paths">
					<div><GitBranch size={13} /><strong>运行时异常路径</strong></div>
					{packet.paths.map((path) => (
						<span key={path.join('>')}>{path.join(' -> ')}</span>
					))}
				</div>
			) : packet?.fallbackReason ? (
				<div className="memory-fallback">{packet.fallbackReason}</div>
			) : null}

			{packet?.signature.length ? (
				<div className="memory-signature">
					{packet.signature.map((tokenValue) => <span key={tokenValue}>{tokenValue}</span>)}
				</div>
			) : null}

			<div className="memory-result-list">
				{packet?.results.map((result) => {
					const { memory } = result;
					return (
						<article className={`memory-result ${memory.status}`} key={memory.id}>
							<div className="memory-result-title">
								<BrainCircuit size={15} />
								<div>
									<strong>{memory.title}</strong>
									<span>{typeLabels[memory.type]} · {memory.serviceName || '跨服务'}</span>
								</div>
								<em>{result.score}</em>
							</div>
							<p>{memory.summary}</p>
							{result.matchedChunks.length > 0 && (
								<div className="memory-hit-chunks">
									{result.matchedChunks.map((match) => (
										<details key={match.chunk.id}>
											<summary><span>{match.chunk.index + 1}</span><strong>{match.chunk.title}</strong><em>{match.score}</em></summary>
											<p>{match.chunk.content}</p>
										</details>
									))}
								</div>
							)}
							<div className="memory-factor-grid">
								{Object.entries({
									拓扑: result.factors.topology,
									签名: result.factors.signature,
									词项: result.factors.lexical,
									稠密: result.factors.dense,
								}).map(([label, value]) => (
									<div key={label}>
										<span>{label}</span>
										<i><b className={scoreClass(value)} style={{ width: `${value}%` }} /></i>
										<strong>{value}</strong>
									</div>
								))}
							</div>
							<div className="memory-result-meta">
								<span className={memory.status}>{statusLabels[memory.status]}</span>
								<span>置信 {memory.confidence}</span>
								<span>活性 {memory.vitality}</span>
								<span>来源 {memory.sources.length}</span>
							</div>
							<div className="memory-result-actions">
								<button type="button" title={memory.pinned ? '取消固定' : '固定'} onClick={() => update(memory, { pinned: !memory.pinned })}>
									{memory.pinned ? <PinOff size={13} /> : <Pin size={13} />}
								</button>
								<button type="button" title="标记为已验证" onClick={() => update(memory, { status: 'verified' })}>
									<CheckCircle2 size={13} />
								</button>
								<button type="button" title="挂起" onClick={() => update(memory, { status: 'suspended' })}>
									<PauseCircle size={13} />
								</button>
								<button type="button" title="归档" onClick={() => update(memory, { status: 'archived' })}>
									<Archive size={13} />
								</button>
								<button type="button" title="遗忘" onClick={() => forget(memory)}>
									<Trash2 size={13} />
								</button>
								{updating === memory.id && <Loader2 className="agent-spin" size={13} />}
							</div>
						</article>
					);
				})}
			</div>

			{!loading && !packet?.results.length && (
				<div className="agent-inspector-empty compact">
					<BrainCircuit size={24} />
					<strong>没有命中运行记忆</strong>
					<span>当前诊断会从实时证据开始，验证后的结论可沉淀为新记忆。</span>
				</div>
			)}
		</div>
	);
}

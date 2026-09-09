import './styles.scss';

/* eslint-disable @typescript-eslint/explicit-function-return-type, sonarjs/no-identical-functions */
import { message, Modal } from 'antd';
import {
	agentApi,
	MemoryItem,
	MemoryRetrievalPacket,
	MemorySampleCatalogItem,
	MemoryScope,
	MemoryStats,
	MemoryStatus,
	MemoryType,
} from 'api/agent/client';
import {
	Archive,
	BookOpen,
	BrainCircuit,
	CheckCircle2,
	CheckSquare2,
	ChevronRight,
	Database,
	FileText,
	GitBranch,
	History,
	Loader2,
	PauseCircle,
	Pin,
	PinOff,
	Plus,
	RefreshCw,
	Search,
	ShieldCheck,
	Sparkles,
	Square,
	Trash2,
	Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'store/reducers';
import AppReducer from 'types/reducer/app';

const typeLabels: Record<MemoryType, string> = {
	working: '工作记忆',
	episodic: '情景记忆',
	semantic: '语义记忆',
	procedural: '程序记忆',
};
const scopeLabels: Record<MemoryScope, string> = {
	organization: '组织',
	user: '用户',
	agent: 'Agent',
	thread: '线程',
	workflow: 'Loop',
};
const statusLabels: Record<MemoryStatus, string> = {
	active: '有效',
	verified: '已验证',
	suspended: '已挂起',
	archived: '已归档',
	forgotten: '已遗忘',
};

interface DraftMemory {
	type: MemoryType;
	scope: MemoryScope;
	title: string;
	summary: string;
	serviceName: string;
	content: string;
	importance: number;
}

const emptyDraft: DraftMemory = {
	type: 'semantic',
	scope: 'user',
	title: '',
	summary: '',
	serviceName: '',
	content: '',
	importance: 70,
};

function formatTime(value: number): string {
	return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function compactId(value: string): string {
	return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function isSampleMemory(memory: MemoryItem): boolean {
	return memory.tags.includes('sample');
}

function sampleItemClass(generated: boolean, selected: boolean): string {
	if (generated) return 'generated';
	if (selected) return 'selected';
	return '';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export default function MemoryManager(): JSX.Element {
	const { user } = useSelector<AppState, AppReducer>((state) => state.app);
	const token = user?.accessJwt || '';
	const [items, setItems] = useState<MemoryItem[]>([]);
	const [stats, setStats] = useState<MemoryStats | null>(null);
	const [selectedId, setSelectedId] = useState('');
	const [query, setQuery] = useState('');
	const [type, setType] = useState<MemoryType | ''>('');
	const [status, setStatus] = useState<MemoryStatus | ''>('');
	const [scope, setScope] = useState<MemoryScope | ''>('');
	const [packet, setPacket] = useState<MemoryRetrievalPacket | null>(null);
	const [loading, setLoading] = useState(false);
	const [updating, setUpdating] = useState(false);
	const [showCreate, setShowCreate] = useState(false);
	const [showSamples, setShowSamples] = useState(false);
	const [sampleLoading, setSampleLoading] = useState(false);
	const [samples, setSamples] = useState<MemorySampleCatalogItem[]>([]);
	const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(
		new Set(),
	);
	const [draft, setDraft] = useState<DraftMemory>(emptyDraft);
	const [note, setNote] = useState('');

	const selected = useMemo(
		() => items.find((item) => item.id === selectedId) || null,
		[items, selectedId],
	);
	const scoreMap = useMemo(
		() =>
			new Map((packet?.results || []).map((result) => [result.memory.id, result])),
		[packet],
	);
	const sampleGroups = useMemo(() => {
		const groups = new Map<
			string,
			{ label: string; items: MemorySampleCatalogItem[] }
		>();
		samples.forEach((sample) => {
			const current = groups.get(sample.category) || {
				label: sample.categoryLabel,
				items: [],
			};
			current.items.push(sample);
			groups.set(sample.category, current);
		});
		return [...groups.entries()].map(([id, group]) => ({ id, ...group }));
	}, [samples]);

	const load = useCallback(async (): Promise<void> => {
		if (!token) return;
		setLoading(true);
		try {
			const [memoryItems, memoryStats] = await Promise.all([
				agentApi.listMemories(token, {
					type: type || undefined,
					status: status || undefined,
					scope: scope || undefined,
					includeInactive: true,
					limit: 300,
				}),
				agentApi.getMemoryStats(token),
			]);
			setItems(memoryItems);
			setStats(memoryStats);
			setSelectedId((current) =>
				memoryItems.some((item) => item.id === current)
					? current
					: memoryItems[0]?.id || '',
			);
		} catch (error) {
			message.error(error instanceof Error ? error.message : '记忆加载失败');
		} finally {
			setLoading(false);
		}
	}, [scope, status, token, type]);

	const loadSamples = useCallback(async (): Promise<void> => {
		if (!token) return;
		setSampleLoading(true);
		try {
			const catalog = await agentApi.listMemorySamples(token);
			setSamples(catalog);
			setSelectedSampleIds((current) => {
				const selectable = new Set(
					catalog
						.filter((sample) => !sample.generatedMemoryId)
						.map((sample) => sample.id),
				);
				return new Set([...current].filter((id) => selectable.has(id)));
			});
		} catch (error) {
			message.error(error instanceof Error ? error.message : '示例记忆加载失败');
		} finally {
			setSampleLoading(false);
		}
	}, [token]);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		setNote(selected?.note || '');
	}, [selected]);

	const openSampleLibrary = async (): Promise<void> => {
		setShowSamples(true);
		await loadSamples();
	};

	const toggleSample = (sampleId: string): void => {
		setSelectedSampleIds((current) => {
			const next = new Set(current);
			if (next.has(sampleId)) next.delete(sampleId);
			else next.add(sampleId);
			return next;
		});
	};

	const toggleSampleGroup = (groupItems: MemorySampleCatalogItem[]): void => {
		const selectableIds = groupItems
			.filter((sample) => !sample.generatedMemoryId)
			.map((sample) => sample.id);
		if (!selectableIds.length) return;
		setSelectedSampleIds((current) => {
			const next = new Set(current);
			const allSelected = selectableIds.every((id) => next.has(id));
			selectableIds.forEach((id) => {
				if (allSelected) next.delete(id);
				else next.add(id);
			});
			return next;
		});
	};

	const generateSamples = async (): Promise<void> => {
		const sampleIds = [...selectedSampleIds];
		if (!sampleIds.length) {
			message.warning('请选择至少一项示例记忆');
			return;
		}
		setSampleLoading(true);
		try {
			const result = await agentApi.generateMemorySamples(token, sampleIds);
			message.success(
				`已生成 ${result.createdCount} 项示例记忆${
					result.existingCount ? `，跳过 ${result.existingCount} 项已存在记忆` : ''
				}`,
			);
			setSelectedSampleIds(new Set());
			await Promise.all([load(), loadSamples()]);
			if (result.memories[0]) setSelectedId(result.memories[0].id);
		} catch (error) {
			message.error(error instanceof Error ? error.message : '示例记忆生成失败');
		} finally {
			setSampleLoading(false);
		}
	};

	const locateSample = async (memoryId: string): Promise<void> => {
		setLoading(true);
		try {
			const [memoryItems, memoryStats] = await Promise.all([
				agentApi.listMemories(token, { includeInactive: true, limit: 300 }),
				agentApi.getMemoryStats(token),
			]);
			setQuery('');
			setType('');
			setScope('');
			setStatus('');
			setPacket(null);
			setItems(memoryItems);
			setStats(memoryStats);
			setSelectedId(memoryId);
			setShowSamples(false);
		} catch (error) {
			message.error(error instanceof Error ? error.message : '示例记忆定位失败');
		} finally {
			setLoading(false);
		}
	};

	const removeSample = (memoryId: string, title: string): void => {
		Modal.confirm({
			title: '删除这项示例记忆？',
			content: `“${title}”将从记忆、分块、来源和关系中彻底移除。以后仍可从示例库重新生成。`,
			okText: '删除示例',
			okButtonProps: { danger: true },
			cancelText: '取消',
			onOk: async () => {
				setSampleLoading(true);
				try {
					await agentApi.deleteMemorySample(token, memoryId);
					message.success('示例记忆已删除');
					await Promise.all([load(), loadSamples()]);
				} catch (error) {
					message.error(error instanceof Error ? error.message : '示例记忆删除失败');
					throw error;
				} finally {
					setSampleLoading(false);
				}
			},
		});
	};

	const search = async (): Promise<void> => {
		if (!query.trim()) {
			setPacket(null);
			await load();
			return;
		}
		setLoading(true);
		try {
			const result = await agentApi.searchMemory(
				token,
				query.trim(),
				undefined,
				30,
			);
			setPacket(result);
			const filtered = result.results
				.map((entry) => entry.memory)
				.filter(
					(memory) =>
						(!type || memory.type === type) &&
						(!status || memory.status === status) &&
						(!scope || memory.scope === scope),
				);
			setItems(filtered);
			setSelectedId(filtered[0]?.id || '');
		} catch (error) {
			message.error(error instanceof Error ? error.message : 'TopoMem 检索失败');
		} finally {
			setLoading(false);
		}
	};

	const update = async (
		memory: MemoryItem,
		patch: Partial<
			Pick<MemoryItem, 'status' | 'pinned' | 'note' | 'confidence' | 'importance'>
		>,
	): Promise<void> => {
		setUpdating(true);
		try {
			await agentApi.updateMemory(token, memory.id, patch);
			await load();
		} catch (error) {
			message.error(error instanceof Error ? error.message : '记忆更新失败');
		} finally {
			setUpdating(false);
		}
	};

	const maintain = async (): Promise<void> => {
		setUpdating(true);
		try {
			const report = await agentApi.maintainMemories(token);
			message.success(
				`维护完成：衰减 ${report.decayed}，合并 ${report.merged}，冲突 ${
					report.conflicts
				}，归档 ${report.archived + report.expired}`,
			);
			await load();
		} catch (error) {
			message.error(error instanceof Error ? error.message : '记忆维护失败');
		} finally {
			setUpdating(false);
		}
	};

	const create = async (): Promise<void> => {
		if (!draft.title.trim() || !draft.summary.trim()) {
			message.warning('请填写标题和摘要');
			return;
		}
		setUpdating(true);
		try {
			const created = await agentApi.createMemory(token, {
				...draft,
				title: draft.title.trim(),
				summary: draft.summary.trim(),
				content: draft.content.trim() || draft.summary.trim(),
				confidence: 70,
				tags: ['manual'],
			});
			setShowCreate(false);
			setDraft(emptyDraft);
			await load();
			setSelectedId(created.id);
		} catch (error) {
			message.error(error instanceof Error ? error.message : '记忆创建失败');
		} finally {
			setUpdating(false);
		}
	};

	const forget = (memory: MemoryItem): void => {
		Modal.confirm({
			title: '遗忘这项记忆？',
			content: '此操作会清除正文与所有可检索字段，无法从界面恢复。',
			okText: '确认遗忘',
			okButtonProps: { danger: true },
			cancelText: '取消',
			onOk: async () => {
				await agentApi.forgetMemory(token, memory.id);
				await load();
			},
		});
	};

	return (
		<div className="memory-manager">
			<header className="memory-header">
				<div>
					<BrainCircuit size={20} />
					<div>
						<strong>Scry 运行记忆</strong>
						<span>TopoMem</span>
					</div>
				</div>
				<div className="memory-header-actions">
					<button
						type="button"
						onClick={openSampleLibrary}
						disabled={sampleLoading}
						title="从论文语料生成示例记忆"
					>
						<BookOpen size={15} />
						示例库
					</button>
					<button
						type="button"
						onClick={maintain}
						disabled={updating}
						title="执行记忆维护"
					>
						<Wrench size={15} />
						维护
					</button>
					<button
						type="button"
						className="primary"
						onClick={() => setShowCreate(true)}
					>
						<Plus size={15} />
						新建
					</button>
				</div>
			</header>

			<section className="memory-stats">
				<div>
					<Database size={15} />
					<strong>{stats?.total || 0}</strong>
					<span>总记忆</span>
				</div>
				<div>
					<Sparkles size={15} />
					<strong>{stats?.online || 0}</strong>
					<span>在线</span>
				</div>
				<div>
					<ShieldCheck size={15} />
					<strong>{stats?.verified || 0}</strong>
					<span>已验证</span>
				</div>
				<div>
					<PauseCircle size={15} />
					<strong>{stats?.suspended || 0}</strong>
					<span>待复核</span>
				</div>
				<div>
					<History size={15} />
					<strong>{stats?.averageVitality || 0}</strong>
					<span>平均活性</span>
				</div>
			</section>

			<div className="memory-toolbar">
				<label className="memory-search">
					<Search size={15} />
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') search();
						}}
						placeholder="检索运行经验"
					/>
					<button type="button" onClick={search}>
						检索
					</button>
				</label>
				<select
					value={type}
					onChange={(event) => setType(event.target.value as MemoryType | '')}
					aria-label="记忆类型"
				>
					<option value="">全部类型</option>
					{Object.entries(typeLabels).map(([value, label]) => (
						<option value={value} key={value}>
							{label}
						</option>
					))}
				</select>
				<select
					value={scope}
					onChange={(event) => setScope(event.target.value as MemoryScope | '')}
					aria-label="记忆作用域"
				>
					<option value="">全部作用域</option>
					{Object.entries(scopeLabels).map(([value, label]) => (
						<option value={value} key={value}>
							{label}
						</option>
					))}
				</select>
				<select
					value={status}
					onChange={(event) => setStatus(event.target.value as MemoryStatus | '')}
					aria-label="记忆状态"
				>
					<option value="">全部状态</option>
					{Object.entries(statusLabels).map(([value, label]) => (
						<option value={value} key={value}>
							{label}
						</option>
					))}
				</select>
				<button
					type="button"
					className="icon"
					onClick={() => {
						setPacket(null);
						load();
					}}
					title="刷新"
				>
					<RefreshCw size={15} />
				</button>
			</div>

			{packet && (
				<div className="memory-strategy-band">
					<div>
						<GitBranch size={15} />
						<strong>{packet.strategy}</strong>
						<span>{packet.latencyMs} ms</span>
					</div>
					<div className="memory-strategy-paths">
						{packet.paths.length ? (
							packet.paths.map((path) => (
								<span key={path.join('>')}>{path.join(' -> ')}</span>
							))
						) : (
							<span>{packet.fallbackReason}</span>
						)}
					</div>
				</div>
			)}

			<div className="memory-body">
				<section className="memory-list-panel">
					<div className="memory-list-head">
						<span>记忆</span>
						<span>服务</span>
						<span>状态</span>
						<span>活性</span>
						<span />
					</div>
					<div className="memory-list">
						{items.map((item) => {
							const retrieval = scoreMap.get(item.id);
							return (
								<button
									type="button"
									className={item.id === selectedId ? 'active' : ''}
									key={item.id}
									onClick={() => setSelectedId(item.id)}
								>
									<div>
										<BrainCircuit size={14} />
										<span>
											<strong>
												{item.title}
												{isSampleMemory(item) && (
													<em className="memory-sample-badge">示例</em>
												)}
											</strong>
											<small>
												{typeLabels[item.type]} · {scopeLabels[item.scope]}
												{retrieval ? ` · 检索 ${retrieval.score}` : ''}
											</small>
										</span>
									</div>
									<span>{item.serviceName || '跨服务'}</span>
									<span className={`memory-state ${item.status}`}>
										{statusLabels[item.status]}
									</span>
									<span className="memory-vitality">
										<i>
											<b style={{ width: `${item.vitality}%` }} />
										</i>
										{item.vitality}
									</span>
									<ChevronRight size={14} />
								</button>
							);
						})}
						{!loading && !items.length && (
							<div className="memory-empty">
								<BrainCircuit size={28} />
								<strong>没有匹配的记忆</strong>
							</div>
						)}
						{loading && (
							<div className="memory-empty">
								<Loader2 className="agent-spin" size={25} />
							</div>
						)}
					</div>
				</section>

				<aside className="memory-detail">
					{selected ? (
						<>
							<div className="memory-detail-heading">
								<div>
									<span>
										{typeLabels[selected.type]} · {scopeLabels[selected.scope]}
										{isSampleMemory(selected) ? ' · 论文语料示例' : ''}
									</span>
									<h2>{selected.title}</h2>
								</div>
								<button
									type="button"
									onClick={() => update(selected, { pinned: !selected.pinned })}
									title={selected.pinned ? '取消固定' : '固定'}
								>
									{selected.pinned ? <PinOff size={15} /> : <Pin size={15} />}
								</button>
							</div>
							<p className="memory-summary-text">{selected.summary}</p>
							<div className="memory-metrics">
								<div>
									<span>置信度</span>
									<strong>{selected.confidence}</strong>
								</div>
								<div>
									<span>重要性</span>
									<strong>{selected.importance}</strong>
								</div>
								<div>
									<span>活性</span>
									<strong>{selected.vitality}</strong>
								</div>
								<div>
									<span>强化</span>
									<strong>{selected.reinforcementCount}</strong>
								</div>
							</div>
							<div className="memory-detail-actions">
								<button
									type="button"
									onClick={() => update(selected, { status: 'verified' })}
								>
									<CheckCircle2 size={14} />
									验证
								</button>
								<button
									type="button"
									onClick={() => update(selected, { status: 'suspended' })}
								>
									<PauseCircle size={14} />
									挂起
								</button>
								<button
									type="button"
									onClick={() => update(selected, { status: 'archived' })}
								>
									<Archive size={14} />
									归档
								</button>
								{isSampleMemory(selected) ? (
									<button
										type="button"
										className="danger"
										onClick={() => removeSample(selected.id, selected.title)}
									>
										<Trash2 size={14} />
										删除示例
									</button>
								) : (
									<button
										type="button"
										className="danger"
										onClick={() => forget(selected)}
									>
										<Trash2 size={14} />
										遗忘
									</button>
								)}
							</div>
							<section className="memory-detail-section">
								<h3>记忆分块 · {selected.chunks.length}</h3>
								<div className="memory-chunk-list">
									{selected.chunks.map((chunk) => {
										const match = scoreMap
											.get(selected.id)
											?.matchedChunks.find((candidate) => candidate.chunk.id === chunk.id);
										return (
											<details key={chunk.id}>
												<summary>
													<span>{String(chunk.index + 1).padStart(2, '0')}</span>
													<div>
														<strong>{chunk.title}</strong>
														<small>
															{chunk.type} · {chunk.tokenCount} tokens
															{match ? ` · 命中 ${match.score}` : ''}
														</small>
													</div>
													<ChevronRight size={13} />
												</summary>
												<p>
													{chunk.content.slice(0, 260)}
													{chunk.content.length > 260 ? '...' : ''}
												</p>
												<pre>{chunk.content}</pre>
												<div className="memory-chunk-keywords">
													{chunk.keywords.map((keyword) => (
														<span key={keyword}>{keyword}</span>
													))}
												</div>
											</details>
										);
									})}
								</div>
							</section>
							<section className="memory-detail-section">
								<h3>完整内容</h3>
								<pre>{JSON.stringify(selected.content, null, 2)}</pre>
							</section>
							<section className="memory-detail-section">
								<h3>来源</h3>
								<div className="memory-source-list">
									{selected.sources.map((source) => (
										<div key={source.id}>
											<span>{source.sourceType}</span>
											<strong title={source.sourceId}>{compactId(source.sourceId)}</strong>
											<em>
												{source.relation} · {source.weight}
											</em>
										</div>
									))}
									{!selected.sources.length && <span className="muted">无来源记录</span>}
								</div>
							</section>
							<section className="memory-detail-section">
								<h3>关系</h3>
								<div className="memory-relation-list">
									{selected.relations.map((relation) => (
										<div key={relation.id}>
											<span className={relation.type}>{relation.type}</span>
											<strong>{relation.rationale}</strong>
											<em>{relation.score}</em>
										</div>
									))}
									{!selected.relations.length && (
										<span className="muted">无关联记忆</span>
									)}
								</div>
							</section>
							<section className="memory-detail-section">
								<h3>备注</h3>
								<textarea
									value={note}
									onChange={(event) => setNote(event.target.value)}
								/>
								<button type="button" onClick={() => update(selected, { note })}>
									保存备注
								</button>
							</section>
							<footer className="memory-audit-meta">
								<span>创建 {formatTime(selected.createdAt)}</span>
								<span>最近访问 {formatTime(selected.lastAccessedAt)}</span>
								<span>{compactId(selected.id)}</span>
							</footer>
						</>
					) : (
						<div className="memory-empty">
							<BrainCircuit size={28} />
							<strong>选择一项记忆</strong>
						</div>
					)}
				</aside>
			</div>

			<Modal
				title="示例记忆库"
				open={showSamples}
				onCancel={() => setShowSamples(false)}
				width={980}
				footer={
					<div className="memory-sample-footer">
						<span>
							已选择 {selectedSampleIds.size}{' '}
							项；生成后作为正常记忆参与检索、预览和维护。
						</span>
						<div>
							<button type="button" onClick={() => setShowSamples(false)}>
								关闭
							</button>
							<button
								type="button"
								className="primary"
								disabled={!selectedSampleIds.size || sampleLoading}
								onClick={generateSamples}
							>
								{sampleLoading ? (
									<Loader2 className="agent-spin" size={15} />
								) : (
									<Sparkles size={15} />
								)}
								生成选中记忆
							</button>
						</div>
					</div>
				}
			>
				<div className="memory-sample-browser">
					<div className="memory-sample-intro">
						<BookOpen size={18} />
						<div>
							<strong>来源于 TopoMem 论文工作目录的运维语料</strong>
							<span>
								示例不是占位数据。它们保留服务路径、错误签名、诊断步骤、修复方法与来源文档，并明确标记为历史经验，不能替代当前证据。
							</span>
						</div>
					</div>
					<div className="memory-sample-catalog">
						{sampleGroups.map((group) => {
							const selectable = group.items.filter(
								(sample) => !sample.generatedMemoryId,
							);
							const allSelected =
								selectable.length > 0 &&
								selectable.every((sample) => selectedSampleIds.has(sample.id));
							return (
								<section key={group.id} className="memory-sample-group">
									<header>
										<button
											type="button"
											disabled={!selectable.length}
											onClick={() => toggleSampleGroup(group.items)}
										>
											{allSelected ? <CheckSquare2 size={17} /> : <Square size={17} />}
											<span>
												<strong>{group.label}</strong>
												<small>
													{group.items.length} 项 · {group.items.length - selectable.length}{' '}
													项已生成
												</small>
											</span>
										</button>
									</header>
									<div className="memory-sample-items">
										{group.items.map((sample) => {
											const generated = Boolean(sample.generatedMemoryId);
											const checked = selectedSampleIds.has(sample.id);
											return (
												<article
													className={sampleItemClass(generated, checked)}
													key={sample.id}
												>
													<button
														type="button"
														className="memory-sample-select"
														disabled={generated}
														onClick={() => toggleSample(sample.id)}
														aria-label={
															checked ? `取消选择 ${sample.title}` : `选择 ${sample.title}`
														}
													>
														{generated || checked ? (
															<CheckSquare2 size={17} />
														) : (
															<Square size={17} />
														)}
													</button>
													<div className="memory-sample-main">
														<div className="memory-sample-title">
															<strong>{sample.title}</strong>
															<span>{typeLabels[sample.type]}</span>
															{generated && <span className="generated">已生成</span>}
														</div>
														<p>{sample.summary}</p>
														<div className="memory-sample-meta">
															<span>根服务 {sample.serviceName}</span>
															<span>置信度 {sample.confidence}</span>
															<span>重要性 {sample.importance}</span>
														</div>
														<div
															className="memory-sample-source"
															title={sample.sourceDocument.path}
														>
															<FileText size={13} />
															<span>{sample.sourceDocument.id}</span>
															<em>{sample.sourceDocument.updatedAt}</em>
														</div>
													</div>
													{generated && (
														<div className="memory-sample-actions">
															<button
																type="button"
																onClick={() => locateSample(sample.generatedMemoryId)}
															>
																查看
															</button>
															<button
																type="button"
																className="danger"
																onClick={() =>
																	removeSample(sample.generatedMemoryId, sample.title)
																}
															>
																删除
															</button>
														</div>
													)}
												</article>
											);
										})}
									</div>
								</section>
							);
						})}
						{sampleLoading && !samples.length && (
							<div className="memory-sample-loading">
								<Loader2 className="agent-spin" size={24} />
								加载示例目录
							</div>
						)}
					</div>
				</div>
			</Modal>

			<Modal
				title="新建记忆"
				open={showCreate}
				onCancel={() => setShowCreate(false)}
				onOk={create}
				confirmLoading={updating}
				okText="写入"
				cancelText="取消"
				width={620}
			>
				<div className="memory-create-form">
					<div className="two">
						<label>
							类型
							<select
								value={draft.type}
								onChange={(event) =>
									setDraft({ ...draft, type: event.target.value as MemoryType })
								}
							>
								{Object.entries(typeLabels).map(([value, label]) => (
									<option value={value} key={value}>
										{label}
									</option>
								))}
							</select>
						</label>
						<label>
							作用域
							<select
								value={draft.scope}
								onChange={(event) =>
									setDraft({ ...draft, scope: event.target.value as MemoryScope })
								}
							>
								{Object.entries(scopeLabels)
									.filter(([value]) => !['thread', 'workflow'].includes(value))
									.map(([value, label]) => (
										<option value={value} key={value}>
											{label}
										</option>
									))}
							</select>
						</label>
					</div>
					<label>
						标题
						<input
							value={draft.title}
							onChange={(event) => setDraft({ ...draft, title: event.target.value })}
						/>
					</label>
					<label>
						服务
						<input
							value={draft.serviceName}
							onChange={(event) =>
								setDraft({ ...draft, serviceName: event.target.value })
							}
						/>
					</label>
					<label>
						摘要
						<textarea
							value={draft.summary}
							onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
						/>
					</label>
					<label>
						结构化内容
						<textarea
							className="large"
							value={draft.content}
							onChange={(event) => setDraft({ ...draft, content: event.target.value })}
						/>
					</label>
				</div>
			</Modal>
		</div>
	);
}

/* eslint-disable react/jsx-props-no-spreading, @typescript-eslint/no-non-null-assertion -- dnd-kit exposes handler collections; guarded control configs lose narrowing inside callbacks. */
import './styles.scss';
import './dashboard.scss';

import {
	DndContext,
	DragEndEvent,
	DragOverlay,
	DragStartEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { message, Modal } from 'antd';
import {
	agentApi,
	WorkflowConditionRule,
	WorkflowRecord,
	WorkflowRunRecord,
	WorkflowStepDefinition,
	WorkflowStepType,
} from 'api/agent/client';
import {
	Bell,
	Bot,
	Braces,
	CalendarClock,
	CheckCircle2,
	ChevronRight,
	Clock3,
	Database,
	GripVertical,
	LayoutDashboard,
	Network,
	Play,
	Plus,
	Repeat2,
	Save,
	Settings2,
	ShieldCheck,
	Trash2,
	UserCheck,
	X,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useHistory, useParams } from 'react-router-dom';
import { AppState } from 'store/reducers';
import AppReducer from 'types/reducer/app';

import LoopDashboard from './LoopDashboard';

interface StepOption {
	type: WorkflowStepType;
	label: string;
	description: string;
	icon: JSX.Element;
}

const STEP_OPTIONS: StepOption[] = [
	{
		type: 'agent',
		label: 'Agent 分析',
		description: '使用当前模型分析上下文',
		icon: <Bot size={16} />,
	},
	{
		type: 'services',
		label: '查询服务',
		description: '读取服务与运行状态',
		icon: <Database size={16} />,
	},
	{
		type: 'alerts',
		label: '查询告警',
		description: '读取当前告警实例',
		icon: <Bell size={16} />,
	},
	{
		type: 'dashboards',
		label: '查询仪表盘',
		description: '读取已有仪表盘',
		icon: <LayoutDashboard size={16} />,
	},
	{
		type: 'mcp-tool',
		label: 'MCP 工具',
		description: '调用内置或远程 MCP 工具',
		icon: <Network size={16} />,
	},
	{
		type: 'security-check',
		label: '安全决策',
		description: '执行不可绕过的安全策略检查',
		icon: <ShieldCheck size={16} />,
	},
	{
		type: 'operation',
		label: '受控执行',
		description: '按审批和工具策略执行操作',
		icon: <Zap size={16} />,
	},
	{
		type: 'verify',
		label: '结果验证',
		description: '复查状态并形成审计结论',
		icon: <CheckCircle2 size={16} />,
	},
	{
		type: 'approval',
		label: '人工审批',
		description: '暂停并等待人工确认',
		icon: <UserCheck size={16} />,
	},
	{
		type: 'condition',
		label: '条件分支',
		description: '按安全条件选择执行分支',
		icon: <Braces size={16} />,
	},
	{
		type: 'parallel',
		label: '并行分支',
		description: '同时执行多个独立分支',
		icon: <Network size={16} />,
	},
	{
		type: 'loop',
		label: '循环节点',
		description: '按条件重复执行有界步骤',
		icon: <Repeat2 size={16} />,
	},
];

const NESTED_STEP_OPTIONS = STEP_OPTIONS.filter((option) =>
	['agent', 'services', 'alerts', 'dashboards', 'approval'].includes(
		option.type,
	),
);

function stepOption(type: WorkflowStepType): StepOption {
	return STEP_OPTIONS.find((option) => option.type === type) || STEP_OPTIONS[0];
}

function createStep(type: WorkflowStepType): WorkflowStepDefinition {
	const option = stepOption(type);
	const step: WorkflowStepDefinition = {
		id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
		name: option.label,
		type,
		retries: 0,
		...(['agent', 'operation', 'verify'].includes(type)
			? { prompt: '根据已有信息继续分析并输出结论、证据和下一步行动。' }
			: {}),
		...(type === 'mcp-tool'
			? { toolId: 'scry_listServices', toolInput: {} }
			: {}),
		...(type === 'approval'
			? { approvalMessage: '请确认是否继续执行后续步骤。' }
			: {}),
	};
	if (type === 'condition') {
		step.condition = {
			rule: { path: 'results.services', operator: 'exists' },
			whenTrue: [createStep('agent')],
			whenFalse: [createStep('agent')],
		};
	}
	if (type === 'parallel') {
		step.parallel = {
			branches: [
				{
					id: `branch_services_${Date.now()}`,
					name: '服务分支',
					steps: [createStep('services')],
				},
				{
					id: `branch_alerts_${Date.now()}`,
					name: '告警分支',
					steps: [createStep('alerts')],
				},
			],
		};
	}
	if (type === 'loop') {
		step.loop = {
			mode: 'until',
			rule: { path: 'results.done', operator: 'equals', value: 'true' },
			maxIterations: 3,
			sourcePath: 'results.items',
			concurrency: 1,
			steps: [createStep('agent')],
		};
	}
	return step;
}

function blankWorkflow(): WorkflowRecord {
	const now = Date.now();
	return {
		id: '',
		name: '新 Loop',
		description: '',
		enabled: true,
		definition: { version: 2, steps: [createStep('agent')] },
		tags: [],
		schedule: { enabled: false, cron: '', timezone: 'Asia/Shanghai' },
		eventTriggers: [],
		inputSchema: [],
		version: 1,
		versions: [],
		createdAt: now,
		updatedAt: now,
	};
}

function runStatusLabel(status: string): string {
	if (status === 'completed') return '执行完成';
	if (status === 'suspended') return '等待审批';
	if (status === 'failed') return '执行失败';
	return '执行中';
}

function runStatusIcon(status: string): JSX.Element {
	if (status === 'completed') return <CheckCircle2 size={14} />;
	if (status === 'suspended') return <ShieldCheck size={14} />;
	return <Bot size={14} />;
}

function loopStepSummary(
	step: WorkflowStepDefinition,
	fallback: string,
): string {
	if (!step.loop) return fallback;
	if (step.loop.mode === 'foreach')
		return `遍历 ${step.loop.sourcePath || '未设置数据源'} · 并发 ${
			step.loop.concurrency || 1
		}`;
	return `${
		step.loop.mode === 'while' ? '满足条件时继续' : '满足条件时停止'
	} · 最多 ${step.loop.maxIterations} 轮`;
}

function stepSummary(step: WorkflowStepDefinition, fallback: string): string {
	if (step.type === 'agent') return step.prompt || fallback;
	if (step.type === 'operation' || step.type === 'verify')
		return step.prompt || fallback;
	if (step.type === 'mcp-tool') return step.toolId || fallback;
	if (step.type === 'approval') return step.approvalMessage || fallback;
	if (step.type === 'condition' && step.condition)
		return `${step.condition.rule.path} ${step.condition.rule.operator} ${
			step.condition.rule.value || ''
		}`.trim();
	if (step.type === 'parallel' && step.parallel)
		return `${step.parallel.branches.length} 个分支并行执行`;
	if (step.type === 'loop') return loopStepSummary(step, fallback);
	return fallback;
}

function PaletteNode({ option }: { option: StepOption }): JSX.Element {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `palette:${option.type}`,
	});
	return (
		<button
			type="button"
			ref={setNodeRef}
			className={`workflow-palette-item ${isDragging ? 'dragging' : ''}`}
			{...listeners}
			{...attributes}
		>
			<span className={`workflow-node-icon ${option.type}`}>{option.icon}</span>
			<span>
				<strong>{option.label}</strong>
				<small>{option.description}</small>
			</span>
			<GripVertical size={14} />
		</button>
	);
}

function SortableNode({
	step,
	index,
	selected,
	onSelect,
	onRemove,
}: {
	step: WorkflowStepDefinition;
	index: number;
	selected: boolean;
	onSelect: () => void;
	onRemove: () => void;
}): JSX.Element {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: step.id });
	const option = stepOption(step.type);
	return (
		<>
			<div className="workflow-connector">
				<span />
			</div>
			<div
				ref={setNodeRef}
				style={{
					transform: transform
						? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
						: undefined,
					transition,
				}}
				className={`workflow-canvas-node ${selected ? 'selected' : ''} ${
					isDragging ? 'dragging' : ''
				}`}
				onClick={onSelect}
				role="button"
				tabIndex={0}
				onKeyDown={(event): void => {
					if (event.key === 'Enter') onSelect();
				}}
			>
				<button
					type="button"
					className="workflow-drag-handle"
					aria-label="拖动步骤"
					{...listeners}
					{...attributes}
				>
					<GripVertical size={16} />
				</button>
				<span className={`workflow-node-icon ${step.type}`}>{option.icon}</span>
				<div className="workflow-node-copy">
					<small>
						步骤 {index + 1} · {option.label}
					</small>
					<strong>{step.name}</strong>
					<span>{stepSummary(step, option.description)}</span>
				</div>
				<button
					type="button"
					className="workflow-node-remove"
					aria-label="删除步骤"
					onClick={(event): void => {
						event.stopPropagation();
						onRemove();
					}}
				>
					<X size={15} />
				</button>
			</div>
		</>
	);
}

function CanvasDropZone({
	children,
}: {
	children: React.ReactNode;
}): JSX.Element {
	const { setNodeRef, isOver } = useDroppable({ id: 'workflow-canvas' });
	return (
		<div
			ref={setNodeRef}
			className={`workflow-canvas-flow ${isOver ? 'over' : ''}`}
		>
			{children}
		</div>
	);
}

const CONDITION_OPERATORS: Array<{
	value: WorkflowConditionRule['operator'];
	label: string;
}> = [
	{ value: 'exists', label: '存在' },
	{ value: 'equals', label: '等于' },
	{ value: 'not_equals', label: '不等于' },
	{ value: 'gt', label: '大于' },
	{ value: 'gte', label: '大于等于' },
	{ value: 'lt', label: '小于' },
	{ value: 'lte', label: '小于等于' },
];

function RuleEditor({
	rule,
	onChange,
}: {
	rule: WorkflowConditionRule;
	onChange: (rule: WorkflowConditionRule) => void;
}): JSX.Element {
	return (
		<div className="workflow-rule-editor">
			<label>
				数据路径
				<input
					value={rule.path}
					onChange={(event): void => onChange({ ...rule, path: event.target.value })}
					placeholder="例如 results.services.total"
				/>
			</label>
			<div className="workflow-rule-row">
				<label>
					比较方式
					<select
						value={rule.operator}
						onChange={(event): void =>
							onChange({
								...rule,
								operator: event.target.value as WorkflowConditionRule['operator'],
							})
						}
					>
						{CONDITION_OPERATORS.map((operator) => (
							<option value={operator.value} key={operator.value}>
								{operator.label}
							</option>
						))}
					</select>
				</label>
				{rule.operator !== 'exists' && (
					<label>
						比较值
						<input
							value={rule.value || ''}
							onChange={(event): void =>
								onChange({ ...rule, value: event.target.value })
							}
						/>
					</label>
				)}
			</div>
		</div>
	);
}

function NestedStepsEditor({
	title,
	steps,
	onChange,
}: {
	title: string;
	steps: WorkflowStepDefinition[];
	onChange: (steps: WorkflowStepDefinition[]) => void;
}): JSX.Element {
	const update = (index: number, patch: Partial<WorkflowStepDefinition>): void =>
		onChange(
			steps.map((step, stepIndex) =>
				stepIndex === index ? { ...step, ...patch } : step,
			),
		);
	return (
		<div className="workflow-nested-editor">
			<div className="workflow-nested-title">
				<strong>{title}</strong>
				<button
					type="button"
					onClick={(): void => onChange([...steps, createStep('agent')])}
				>
					<Plus size={12} /> 添加
				</button>
			</div>
			{steps.map((step, index) => (
				<div className="workflow-nested-step" key={step.id}>
					<span>{index + 1}</span>
					<select
						value={step.type}
						onChange={(event): void => {
							const replacement = createStep(event.target.value as WorkflowStepType);
							update(index, { ...replacement, id: step.id });
						}}
					>
						{NESTED_STEP_OPTIONS.map((option) => (
							<option value={option.type} key={option.type}>
								{option.label}
							</option>
						))}
					</select>
					<input
						value={step.name}
						onChange={(event): void => update(index, { name: event.target.value })}
					/>
					<button
						type="button"
						aria-label="删除分支节点"
						disabled={steps.length === 1}
						onClick={(): void =>
							onChange(steps.filter((_, stepIndex) => stepIndex !== index))
						}
					>
						<X size={13} />
					</button>
				</div>
			))}
		</div>
	);
}

// The editor coordinates canvas, nested control-node forms, persistence and run history in one surface.
// eslint-disable-next-line sonarjs/cognitive-complexity
function WorkflowEditor({ workflowId }: { workflowId: string }): JSX.Element {
	const { user } = useSelector<AppState, AppReducer>((state) => state.app);
	const token = user?.accessJwt || '';
	const history = useHistory();
	const [selected, setSelected] = useState<WorkflowRecord>(blankWorkflow());
	const [selectedStepId, setSelectedStepId] = useState('');
	const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
	const [runInputs, setRunInputs] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [activeDragId, setActiveDragId] = useState('');
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
	);

	const selectedStepIndex = selected.definition.steps.findIndex(
		(step) => step.id === selectedStepId,
	);
	const selectedStep = selected.definition.steps[selectedStepIndex];

	const load = useCallback(async (): Promise<void> => {
		if (!token) return;
		const records = await agentApi.listWorkflows(token);
		setSelected(
			records.find((item) => item.id === workflowId) ||
				records[0] ||
				blankWorkflow(),
		);
	}, [token, workflowId]);

	useEffect(() => {
		load().catch((error) => message.error(error.message));
	}, [load]);
	useEffect(() => {
		setSelectedStepId((current) =>
			selected.definition.steps.some((step) => step.id === current)
				? current
				: selected.definition.steps[0]?.id || '',
		);
	}, [selected.id, selected.definition.steps]);
	useEffect(() => {
		if (!selected.id) {
			setRuns([]);
			return;
		}
		agentApi
			.listWorkflowRuns(token, selected.id)
			.then(setRuns)
			.catch(() => setRuns([]));
	}, [selected.id, token]);

	const patchStep = (patch: Partial<WorkflowStepDefinition>): void => {
		if (selectedStepIndex < 0) return;
		setSelected((current) => ({
			...current,
			definition: {
				...current.definition,
				version: 2,
				steps: current.definition.steps.map((step, index) =>
					index === selectedStepIndex ? { ...step, ...patch } : step,
				),
			},
		}));
	};

	const changeSelectedStepType = (type: WorkflowStepType): void => {
		if (!selectedStep) return;
		const replacement = createStep(type);
		patchStep({ ...replacement, id: selectedStep.id });
	};

	const removeStep = (stepId: string): void => {
		if (selected.definition.steps.length === 1) {
			message.warning('Loop 至少需要一个执行节点');
			return;
		}
		setSelected((current) => ({
			...current,
			definition: {
				...current.definition,
				steps: current.definition.steps.filter((step) => step.id !== stepId),
			},
		}));
	};

	const addStep = (
		type: WorkflowStepType,
		index = selected.definition.steps.length,
	): void => {
		const step = createStep(type);
		const steps = [...selected.definition.steps];
		steps.splice(index, 0, step);
		setSelected({
			...selected,
			definition: { ...selected.definition, version: 2, steps },
		});
		setSelectedStepId(step.id);
	};

	const handleDragStart = ({ active }: DragStartEvent): void =>
		setActiveDragId(String(active.id));
	const handleDragEnd = ({ active, over }: DragEndEvent): void => {
		setActiveDragId('');
		if (!over) return;
		const activeId = String(active.id);
		const overId = String(over.id);
		if (activeId.startsWith('palette:')) {
			const type = activeId.slice('palette:'.length) as WorkflowStepType;
			const targetIndex = selected.definition.steps.findIndex(
				(step) => step.id === overId,
			);
			addStep(
				type,
				targetIndex < 0 ? selected.definition.steps.length : targetIndex,
			);
			return;
		}
		const oldIndex = selected.definition.steps.findIndex(
			(step) => step.id === activeId,
		);
		const newIndex = selected.definition.steps.findIndex(
			(step) => step.id === overId,
		);
		if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
			setSelected({
				...selected,
				definition: {
					...selected.definition,
					steps: arrayMove(selected.definition.steps, oldIndex, newIndex),
				},
			});
		}
	};

	const save = async (): Promise<void> => {
		setSaving(true);
		try {
			const saved = selected.id
				? await agentApi.updateWorkflow(token, selected)
				: await agentApi.createWorkflow(token, selected);
			setSelected(saved);
			await load();
			message.success('Loop 已保存');
		} catch (error) {
			message.error(error instanceof Error ? error.message : '保存失败');
		} finally {
			setSaving(false);
		}
	};

	const removeWorkflow = (): void => {
		if (!selected.id) return;
		Modal.confirm({
			title: '删除 Loop',
			content: 'Loop 定义及其运行记录会被删除。',
			okText: '删除',
			cancelText: '取消',
			okButtonProps: { danger: true },
			onOk: async () => {
				await agentApi.deleteWorkflow(token, selected.id);
				setSelected(blankWorkflow());
				await load();
			},
		});
	};

	const openRunWithInputs = (input?: unknown): void => {
		const values =
			input && typeof input === 'object'
				? (input as Record<string, unknown>)
				: runInputs;
		const previousMessage =
			typeof values.message === 'string' ? values.message : '';
		const messageText =
			previousMessage ||
			(selected.inputSchema.length
				? selected.inputSchema
						.map(
							(field) =>
								`${field.label}: ${String(
									values[field.id] ?? field.defaultValue ?? '',
								)}`,
						)
						.join('\n')
				: '请执行这个 Loop，并返回每个节点的结果和最终结论。');
		history.push(
			`/ai?workflowId=${encodeURIComponent(
				selected.id,
			)}&input=${encodeURIComponent(messageText)}`,
		);
	};

	const activeOption = useMemo(
		() =>
			activeDragId.startsWith('palette:')
				? stepOption(activeDragId.slice(8) as WorkflowStepType)
				: null,
		[activeDragId],
	);

	return (
		<div className="workflow-manager">
			<main className="workflow-editor">
				<header className="workflow-editor-header">
					<div className="workflow-breadcrumb">
						<button
							type="button"
							className="workflow-back-button"
							onClick={(): void => history.push('/ai/loops')}
							aria-label="返回 Loop 管理台"
						>
							<ChevronRight size={14} className="back-icon" />
						</button>
						<span>Loops</span>
						<ChevronRight size={14} />
						<input
							value={selected.name}
							aria-label="Loop 名称"
							onChange={(event): void =>
								setSelected({ ...selected, name: event.target.value })
							}
						/>
					</div>
					<div className="workflow-actions">
						<span className="workflow-version-badge">v{selected.version}</span>
						{selected.id && (
							<button
								type="button"
								className="icon-danger"
								aria-label="删除 Loop"
								onClick={removeWorkflow}
							>
								<Trash2 size={15} />
							</button>
						)}
						<button
							type="button"
							className="primary"
							disabled={saving}
							onClick={save}
						>
							<Save size={15} />
							{saving ? '保存中' : '保存'}
						</button>
					</div>
				</header>

				<DndContext
					sensors={sensors}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				>
					<div className="workflow-builder">
						<aside className="workflow-palette">
							<div>
								<strong>节点</strong>
								<span>拖入画布添加</span>
							</div>
							{STEP_OPTIONS.map((option) => (
								<PaletteNode option={option} key={option.type} />
							))}
						</aside>
						<div className="workflow-canvas">
							<div className="workflow-canvas-toolbar">
								<button
									type="button"
									title="添加 Agent 节点"
									onClick={(): void => addStep('agent')}
								>
									<Plus size={13} />
									<Bot size={13} />
								</button>
								<button
									type="button"
									title="添加服务查询节点"
									onClick={(): void => addStep('services')}
								>
									<Plus size={13} />
									<Database size={13} />
								</button>
								<span>拖动节点可调整顺序</span>
							</div>
							<CanvasDropZone>
								<div className="workflow-terminal start">
									<span>触发器</span>
									<strong>对话调用本轮 Loop</strong>
								</div>
								<SortableContext
									items={selected.definition.steps.map((step) => step.id)}
									strategy={verticalListSortingStrategy}
								>
									{selected.definition.steps.map((step, index) => (
										<SortableNode
											key={step.id}
											step={step}
											index={index}
											selected={step.id === selectedStepId}
											onSelect={(): void => setSelectedStepId(step.id)}
											onRemove={(): void => removeStep(step.id)}
										/>
									))}
								</SortableContext>
								<div className="workflow-connector">
									<span />
								</div>
								<div className="workflow-terminal end">
									<span>结束本轮</span>
									<strong>保存并输出结果</strong>
								</div>
							</CanvasDropZone>
						</div>
					</div>
					<DragOverlay>
						{activeOption && (
							<div className="workflow-drag-overlay">
								<span className={`workflow-node-icon ${activeOption.type}`}>
									{activeOption.icon}
								</span>
								<strong>{activeOption.label}</strong>
							</div>
						)}
					</DragOverlay>
				</DndContext>
			</main>

			<aside className="workflow-inspector">
				<div className="workflow-inspector-heading">
					<Settings2 size={16} />
					<strong>{selectedStep ? '节点设置' : 'Loop 设置'}</strong>
				</div>
				<div className="workflow-inspector-body">
					<section className="workflow-config-section">
						<label>
							Loop 说明
							<textarea
								value={selected.description}
								onChange={(event): void =>
									setSelected({ ...selected, description: event.target.value })
								}
								placeholder="说明这个 Loop 的目标和运行边界"
							/>
						</label>
						<label className="workflow-toggle">
							<input
								type="checkbox"
								checked={selected.enabled}
								onChange={(event): void =>
									setSelected({ ...selected, enabled: event.target.checked })
								}
							/>
							<span>
								<strong>允许对话触发</strong>
								<small>停用后不再出现在对话选择器中</small>
							</span>
						</label>
						<div className="workflow-control-config workflow-loop-settings">
							<div className="workflow-control-heading">
								<span>
									<CalendarClock size={13} /> 运行入口
								</span>
							</div>
							<label className="workflow-toggle">
								<input
									type="checkbox"
									checked={selected.schedule.enabled}
									onChange={(event): void =>
										setSelected({
											...selected,
											schedule: { ...selected.schedule, enabled: event.target.checked },
										})
									}
								/>
								<span>
									<strong>定时调度</strong>
									<small>保存 Cron 与时区配置；后台任务执行器接入后生效</small>
								</span>
							</label>
							{selected.schedule.enabled && (
								<div className="workflow-rule-row">
									<label>
										执行规则
										<input
											value={selected.schedule.cron}
											onChange={(event): void =>
												setSelected({
													...selected,
													schedule: { ...selected.schedule, cron: event.target.value },
												})
											}
											placeholder="0 */15 * * *"
										/>
									</label>
									<label>
										时区
										<input
											value={selected.schedule.timezone}
											onChange={(event): void =>
												setSelected({
													...selected,
													schedule: { ...selected.schedule, timezone: event.target.value },
												})
											}
										/>
									</label>
								</div>
							)}
							<div className="workflow-control-heading workflow-subheading">
								<span>
									<Zap size={13} /> 事件触发
								</span>
								<button
									type="button"
									onClick={(): void =>
										setSelected({
											...selected,
											eventTriggers: [
												...selected.eventTriggers,
												{
													id: `event_${Date.now()}`,
													eventType: 'alert.created',
													filter: '',
													enabled: true,
												},
											],
										})
									}
								>
									<Plus size={12} /> 添加
								</button>
							</div>
							{selected.eventTriggers.map((trigger, index) => (
								<div className="workflow-trigger-row" key={trigger.id}>
									<input
										value={trigger.eventType}
										aria-label="事件类型"
										onChange={(event): void =>
											setSelected({
												...selected,
												eventTriggers: selected.eventTriggers.map((item, itemIndex) =>
													itemIndex === index
														? { ...item, eventType: event.target.value }
														: item,
												),
											})
										}
									/>
									<input
										value={trigger.filter}
										aria-label="事件过滤器"
										placeholder="过滤条件（可选）"
										onChange={(event): void =>
											setSelected({
												...selected,
												eventTriggers: selected.eventTriggers.map((item, itemIndex) =>
													itemIndex === index
														? { ...item, filter: event.target.value }
														: item,
												),
											})
										}
									/>
									<button
										type="button"
										aria-label="删除事件触发器"
										onClick={(): void =>
											setSelected({
												...selected,
												eventTriggers: selected.eventTriggers.filter(
													(_, itemIndex) => itemIndex !== index,
												),
											})
										}
									>
										<X size={13} />
									</button>
								</div>
							))}
							{selected.inputSchema.map((field) => (
								<label className="workflow-run-input" key={`run-${field.id}`}>
									{field.label}
									{field.description && <small>{field.description}</small>}
									<input
										value={runInputs[field.id] || ''}
										placeholder={field.defaultValue || `输入${field.label}`}
										onChange={(event): void =>
											setRunInputs({ ...runInputs, [field.id]: event.target.value })
										}
									/>
								</label>
							))}
							<button
								type="button"
								className="workflow-run-now"
								onClick={(): void => openRunWithInputs()}
							>
								<Play size={13} /> 使用此 Schema 运行
							</button>
						</div>
						<div className="workflow-control-config workflow-input-schema">
							<div className="workflow-control-heading">
								<span>运行输入 Schema</span>
								<button
									type="button"
									onClick={(): void =>
										setSelected({
											...selected,
											inputSchema: [
												...selected.inputSchema,
												{
													id: `input_${Date.now()}`,
													label: '新输入',
													type: 'text',
													required: false,
													description: '',
												},
											],
										})
									}
								>
									<Plus size={12} /> 添加字段
								</button>
							</div>
							{selected.inputSchema.map((field, index) => (
								<div className="workflow-input-row" key={field.id}>
									<input
										value={field.label}
										aria-label="输入字段名称"
										onChange={(event): void =>
											setSelected({
												...selected,
												inputSchema: selected.inputSchema.map((item, itemIndex) =>
													itemIndex === index
														? { ...item, label: event.target.value }
														: item,
												),
											})
										}
									/>
									<select
										value={field.type}
										onChange={(event): void =>
											setSelected({
												...selected,
												inputSchema: selected.inputSchema.map((item, itemIndex) =>
													itemIndex === index
														? { ...item, type: event.target.value as typeof field.type }
														: item,
												),
											})
										}
									>
										<option value="text">文本</option>
										<option value="number">数字</option>
										<option value="boolean">布尔</option>
										<option value="json">JSON</option>
									</select>
									<label className="workflow-inline-check">
										<input
											type="checkbox"
											checked={field.required}
											onChange={(event): void =>
												setSelected({
													...selected,
													inputSchema: selected.inputSchema.map((item, itemIndex) =>
														itemIndex === index
															? { ...item, required: event.target.checked }
															: item,
													),
												})
											}
										/>
										必填
									</label>
									<button
										type="button"
										aria-label="删除输入字段"
										onClick={(): void =>
											setSelected({
												...selected,
												inputSchema: selected.inputSchema.filter(
													(_, itemIndex) => itemIndex !== index,
												),
											})
										}
									>
										<X size={13} />
									</button>
								</div>
							))}
						</div>
						<div className="workflow-control-config workflow-tags-config">
							<div className="workflow-control-heading">
								<span>标签</span>
							</div>
							<input
								value={selected.tags.join(', ')}
								onChange={(event): void =>
									setSelected({
										...selected,
										tags: event.target.value
											.split(',')
											.map((tag) => tag.trim())
											.filter(Boolean)
											.slice(0, 20),
									})
								}
								placeholder="诊断, 生产, 每日"
							/>
						</div>
					</section>
					{selectedStep && (
						<section className="workflow-config-section node-config">
							<div className="workflow-config-title">
								<span className={`workflow-node-icon ${selectedStep.type}`}>
									{stepOption(selectedStep.type).icon}
								</span>
								<div>
									<strong>{stepOption(selectedStep.type).label}</strong>
									<small>{selectedStep.id}</small>
								</div>
							</div>
							<label>
								节点名称
								<input
									value={selectedStep.name}
									onChange={(event): void => patchStep({ name: event.target.value })}
								/>
							</label>
							<label>
								节点类型
								<select
									value={selectedStep.type}
									onChange={(event): void =>
										changeSelectedStepType(event.target.value as WorkflowStepType)
									}
								>
									{STEP_OPTIONS.map((option) => (
										<option value={option.type} key={option.type}>
											{option.label}
										</option>
									))}
								</select>
							</label>
							{['agent', 'operation', 'verify'].includes(selectedStep.type) && (
								<label>
									Agent 指令
									<textarea
										className="large"
										value={selectedStep.prompt || ''}
										onChange={(event): void => patchStep({ prompt: event.target.value })}
									/>
								</label>
							)}
							{selectedStep.type === 'mcp-tool' && (
								<>
									<label>
										MCP 工具 ID
										<input
											value={selectedStep.toolId || ''}
											onChange={(event): void => patchStep({ toolId: event.target.value })}
											placeholder="scry_listServices"
										/>
									</label>
									<label>
										工具参数 JSON
										<textarea
											value={JSON.stringify(selectedStep.toolInput || {}, null, 2)}
											onChange={(event): void => {
												try {
													patchStep({ toolInput: JSON.parse(event.target.value) });
												} catch {
													// Keep the last valid object while the user is typing.
												}
											}}
										/>
									</label>
								</>
							)}
							{selectedStep.type === 'approval' && (
								<label>
									审批提示
									<textarea
										value={selectedStep.approvalMessage || ''}
										onChange={(event): void =>
											patchStep({ approvalMessage: event.target.value })
										}
									/>
								</label>
							)}
							{!['condition', 'parallel', 'loop'].includes(selectedStep.type) && (
								<label>
									失败重试次数
									<input
										type="number"
										min={0}
										max={10}
										value={selectedStep.retries || 0}
										onChange={(event): void =>
											patchStep({ retries: Number(event.target.value) })
										}
									/>
								</label>
							)}
							{selectedStep.type === 'condition' && selectedStep.condition && (
								<div className="workflow-control-config">
									<div className="workflow-control-heading">判断条件</div>
									<RuleEditor
										rule={selectedStep.condition.rule}
										onChange={(rule): void =>
											patchStep({
												condition: { ...selectedStep.condition!, rule },
											})
										}
									/>
									<NestedStepsEditor
										title="条件成立"
										steps={selectedStep.condition.whenTrue}
										onChange={(whenTrue): void =>
											patchStep({
												condition: { ...selectedStep.condition!, whenTrue },
											})
										}
									/>
									<NestedStepsEditor
										title="条件不成立"
										steps={selectedStep.condition.whenFalse}
										onChange={(whenFalse): void =>
											patchStep({
												condition: { ...selectedStep.condition!, whenFalse },
											})
										}
									/>
								</div>
							)}
							{selectedStep.type === 'parallel' && selectedStep.parallel && (
								<div className="workflow-control-config">
									<div className="workflow-control-heading">
										<span>并行分支</span>
										<button
											type="button"
											disabled={selectedStep.parallel.branches.length >= 6}
											onClick={(): void =>
												patchStep({
													parallel: {
														branches: [
															...selectedStep.parallel!.branches,
															{
																id: `branch_${Date.now()}`,
																name: '新分支',
																steps: [createStep('agent')],
															},
														],
													},
												})
											}
										>
											<Plus size={12} /> 添加分支
										</button>
									</div>
									{selectedStep.parallel.branches.map((branch, branchIndex) => (
										<div className="workflow-branch-config" key={branch.id}>
											<div className="workflow-branch-name">
												<input
													value={branch.name}
													onChange={(event): void =>
														patchStep({
															parallel: {
																branches: selectedStep.parallel!.branches.map((item, index) =>
																	index === branchIndex
																		? { ...item, name: event.target.value }
																		: item,
																),
															},
														})
													}
												/>
												<button
													type="button"
													aria-label="删除并行分支"
													disabled={selectedStep.parallel!.branches.length === 2}
													onClick={(): void =>
														patchStep({
															parallel: {
																branches: selectedStep.parallel!.branches.filter(
																	(_, index) => index !== branchIndex,
																),
															},
														})
													}
												>
													<X size={13} />
												</button>
											</div>
											<NestedStepsEditor
												title={`分支 ${branchIndex + 1}`}
												steps={branch.steps}
												onChange={(steps): void =>
													patchStep({
														parallel: {
															branches: selectedStep.parallel!.branches.map((item, index) =>
																index === branchIndex ? { ...item, steps } : item,
															),
														},
													})
												}
											/>
										</div>
									))}
								</div>
							)}
							{selectedStep.type === 'loop' && selectedStep.loop && (
								<div className="workflow-control-config">
									<div className="workflow-control-heading">循环策略</div>
									<div className="workflow-rule-row">
										<label>
											循环模式
											<select
												value={selectedStep.loop.mode}
												onChange={(event): void =>
													patchStep({
														loop: {
															...selectedStep.loop!,
															mode: event.target.value as 'while' | 'until' | 'foreach',
														},
													})
												}
											>
												<option value="while">条件成立时继续</option>
												<option value="until">条件成立时停止</option>
												<option value="foreach">遍历数组</option>
											</select>
										</label>
										<label>
											{selectedStep.loop.mode === 'foreach' ? '最大项目数' : '最大轮次'}
											<input
												type="number"
												min={1}
												max={50}
												value={selectedStep.loop.maxIterations}
												onChange={(event): void =>
													patchStep({
														loop: {
															...selectedStep.loop!,
															maxIterations: Number(event.target.value),
														},
													})
												}
											/>
										</label>
									</div>
									{selectedStep.loop.mode === 'foreach' ? (
										<div className="workflow-rule-row">
											<label>
												数组数据路径
												<input
													value={selectedStep.loop.sourcePath || ''}
													onChange={(event): void =>
														patchStep({
															loop: {
																...selectedStep.loop!,
																sourcePath: event.target.value,
															},
														})
													}
												/>
											</label>
											<label>
												并发数
												<input
													type="number"
													min={1}
													max={10}
													value={selectedStep.loop.concurrency || 1}
													onChange={(event): void =>
														patchStep({
															loop: {
																...selectedStep.loop!,
																concurrency: Number(event.target.value),
															},
														})
													}
												/>
											</label>
										</div>
									) : (
										<RuleEditor
											rule={selectedStep.loop.rule}
											onChange={(rule): void =>
												patchStep({ loop: { ...selectedStep.loop!, rule } })
											}
										/>
									)}
									<NestedStepsEditor
										title="循环体"
										steps={selectedStep.loop.steps}
										onChange={(steps): void =>
											patchStep({ loop: { ...selectedStep.loop!, steps } })
										}
									/>
								</div>
							)}
						</section>
					)}
					<section className="workflow-config-section workflow-version-history">
						<div className="workflow-section-title">
							<Clock3 size={14} />
							<strong>时间旅行 · 历史版本</strong>
						</div>
						<p className="workflow-history-hint">
							保存后会保留最近 30 个版本。载入历史版本后可检查节点并另存为新版本。
						</p>
						{selected.versions.length === 0 && (
							<div className="workflow-empty">保存后将在这里显示历史版本</div>
						)}
						{[...selected.versions]
							.reverse()
							.slice(0, 8)
							.map((version) => (
								<div
									className="workflow-version-row"
									key={`${version.version}-${version.createdAt}`}
								>
									<div>
										<strong>
											v{version.version} · {version.name}
										</strong>
										<span>
											{new Date(version.createdAt).toLocaleString('zh-CN')} ·{' '}
											{version.definition.steps.length} 个节点
										</span>
									</div>
									<button
										type="button"
										onClick={(): void =>
											setSelected({
												...selected,
												name: version.name,
												definition: version.definition,
											})
										}
									>
										载入
									</button>
								</div>
							))}
					</section>
					<section className="workflow-config-section workflow-run-history">
						<div className="workflow-section-title">
							<Play size={14} />
							<strong>最近运行</strong>
						</div>
						{runs.slice(0, 8).map((run) => (
							<div className="workflow-run" key={run.id}>
								{runStatusIcon(run.status)}
								<div>
									<strong>{runStatusLabel(run.status)}</strong>
									<span>{new Date(run.createdAt).toLocaleString()}</span>
								</div>
								<button
									type="button"
									className="workflow-rerun-button"
									onClick={(): void => openRunWithInputs(run.input)}
								>
									从此输入重跑
								</button>
							</div>
						))}
						{!runs.length && <div className="workflow-empty">暂无运行记录</div>}
					</section>
				</div>
			</aside>
		</div>
	);
}

export default function WorkflowManager(): JSX.Element {
	const { workflowId } = useParams<{ workflowId?: string }>();
	return workflowId ? (
		<WorkflowEditor workflowId={workflowId} />
	) : (
		<LoopDashboard />
	);
}

import type { MenuProps } from 'antd';
import { Dropdown, Input, message, Modal } from 'antd';
import { agentApi, WorkflowRecord } from 'api/agent/client';
import ROUTES from 'constants/routes';
import {
	CalendarClock,
	Clock3,
	Copy,
	Edit3,
	GitBranch,
	MoreHorizontal,
	Play,
	Plus,
	Power,
	Search,
	Trash2,
	Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { AppState } from 'store/reducers';
import AppReducer from 'types/reducer/app';

function newLoop(): Omit<WorkflowRecord, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		name: '新 Loop',
		description: '新的可观测性运维流程。',
		enabled: true,
		definition: {
			version: 2,
			steps: [{
				id: `agent_${Date.now()}`,
				name: 'Agent 分析',
				type: 'agent',
				retries: 0,
				prompt: '根据已有信息分析并输出结论、证据和下一步行动。',
			}],
		},
		tags: [],
		schedule: { enabled: false, cron: '', timezone: 'Asia/Shanghai' },
		eventTriggers: [],
		inputSchema: [],
		version: 1,
		versions: [],
	};
}

function workflowKind(workflow: WorkflowRecord): string {
	if (workflow.schedule.enabled) return '定时';
	if (workflow.eventTriggers.some((trigger) => trigger.enabled)) return '事件';
	return '对话';
}

function workflowUpdatedAt(workflow: WorkflowRecord): string {
	return new Date(workflow.updatedAt).toLocaleString('zh-CN', {
		year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
	});
}

function TriggerSummary({ workflow }: { workflow: WorkflowRecord }): JSX.Element {
	if (workflow.schedule.enabled) return <span><CalendarClock size={12} />{workflow.schedule.cron || '已配置'}</span>;
	const eventCount = workflow.eventTriggers.filter((trigger) => trigger.enabled).length;
	if (eventCount) return <span><Zap size={12} />{eventCount} 个事件</span>;
	return <span><Play size={12} />对话触发</span>;
}

function LoopRow({
	workflow,
	onOpen,
	onAction,
}: {
	workflow: WorkflowRecord;
	onOpen: () => void;
	onAction: (action: 'rename' | 'toggle' | 'duplicate' | 'delete') => void;
}): JSX.Element {
	const menu: MenuProps = {
		items: [
			{ key: 'rename', label: '重命名', icon: <Edit3 size={14} /> },
			{ key: 'toggle', label: workflow.enabled ? '停用' : '启用', icon: <Power size={14} /> },
			{ key: 'duplicate', label: '创建副本', icon: <Copy size={14} /> },
			{ type: 'divider' },
			{ key: 'delete', label: '删除', danger: true, icon: <Trash2 size={14} /> },
		],
		onClick: ({ key }) => onAction(key as 'rename' | 'toggle' | 'duplicate' | 'delete'),
	};
	return (
		<div className="loop-row">
			<button type="button" className="loop-row-main" onClick={onOpen}>
				<div className="loop-row-name">
					<GitBranch size={15} />
					<div>
						<strong>{workflow.name}</strong>
						<span>{workflow.description || '未填写说明'}{workflow.tags.length ? ` · ${workflow.tags.slice(0, 2).join(' / ')}` : ''}</span>
					</div>
				</div>
				<span>{workflowKind(workflow)}</span>
				<TriggerSummary workflow={workflow} />
				<span>{workflow.definition.steps.length}</span>
				<span className={`loop-row-status ${workflow.enabled ? 'enabled' : ''}`}><i />{workflow.enabled ? '启用' : '停用'}</span>
				<span>{workflowUpdatedAt(workflow)}</span>
			</button>
			<Dropdown menu={menu} trigger={['click']} placement="bottomRight">
				<button type="button" className="loop-row-menu" aria-label={`${workflow.name}操作菜单`}><MoreHorizontal size={16} /></button>
			</Dropdown>
		</div>
	);
}

export default function LoopDashboard(): JSX.Element {
	const history = useHistory();
	const { user } = useSelector<AppState, AppReducer>((state) => state.app);
	const token = user?.accessJwt || '';
	const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<'all' | 'enabled' | 'schedule' | 'event'>('all');
	const [sort, setSort] = useState<'updated' | 'created' | 'name'>('updated');
	const [loading, setLoading] = useState(true);
	const [renameTarget, setRenameTarget] = useState<WorkflowRecord | null>(null);
	const [renameValue, setRenameValue] = useState('');

	const load = useCallback(async (): Promise<void> => {
		if (!token) return;
		setWorkflows(await agentApi.listWorkflows(token));
	}, [token]);

	useEffect(() => {
		load().catch((error) => message.error(error.message)).finally(() => setLoading(false));
	}, [load]);

	const visibleWorkflows = useMemo(() => workflows.filter((workflow) => {
		const matchesQuery = !query.trim() || [workflow.name, workflow.description, ...workflow.tags]
			.join(' ').toLowerCase().includes(query.trim().toLowerCase());
		const matchesFilter = filter === 'all' || (filter === 'enabled' && workflow.enabled)
			|| (filter === 'schedule' && workflow.schedule.enabled)
			|| (filter === 'event' && workflow.eventTriggers.some((trigger) => trigger.enabled));
		return matchesQuery && matchesFilter;
	}).sort((left, right) => {
		if (sort === 'name') return left.name.localeCompare(right.name, 'zh-CN');
		return sort === 'created' ? right.createdAt - left.createdAt : right.updatedAt - left.updatedAt;
	}), [filter, query, sort, workflows]);

	const create = async (): Promise<void> => {
		try {
			const created = await agentApi.createWorkflow(token, newLoop());
			await load();
			history.push(`${ROUTES.AI_LOOPS}/${created.id}`);
		} catch (error) {
			message.error(error instanceof Error ? error.message : '创建 Loop 失败');
		}
	};

	const updateWorkflow = async (workflow: WorkflowRecord, patch: Partial<WorkflowRecord>): Promise<void> => {
		await agentApi.updateWorkflow(token, { ...workflow, ...patch });
		await load();
	};

	const handleAction = (workflow: WorkflowRecord, action: 'rename' | 'toggle' | 'duplicate' | 'delete'): void => {
		if (action === 'rename') {
			setRenameTarget(workflow);
			setRenameValue(workflow.name);
			return;
		}
		if (action === 'delete') {
			Modal.confirm({
				title: '删除 Loop', content: `确定删除“${workflow.name}”吗？运行记录也会被删除。`,
				okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
				onOk: async () => { await agentApi.deleteWorkflow(token, workflow.id); await load(); message.success('Loop 已删除'); },
			});
			return;
		}
		const operation = action === 'toggle'
			? updateWorkflow(workflow, { enabled: !workflow.enabled }).then(() => message.success(workflow.enabled ? 'Loop 已停用' : 'Loop 已启用'))
			: agentApi.createWorkflow(token, { ...workflow, name: `${workflow.name} 副本`, version: 1, versions: [] })
				.then(load).then(() => message.success('Loop 副本已创建'));
		operation.catch((error) => message.error(error instanceof Error ? error.message : '操作失败'));
	};

	return (
		<div className="loop-dashboard">
			<Modal open={Boolean(renameTarget)} title="重命名 Loop" okText="保存" cancelText="取消"
				okButtonProps={{ disabled: !renameValue.trim() }} onCancel={() => setRenameTarget(null)}
				onOk={async () => {
					if (!renameTarget || !renameValue.trim()) return;
					try { await updateWorkflow(renameTarget, { name: renameValue.trim() }); setRenameTarget(null); message.success('Loop 名称已更新'); }
					catch (error) { message.error(error instanceof Error ? error.message : '重命名失败'); }
				}}>
				<Input value={renameValue} maxLength={100} autoFocus onChange={(event) => setRenameValue(event.target.value)} />
			</Modal>

			<header className="loop-dashboard-header">
				<div><GitBranch size={19} /><div><strong>Scry Loop</strong><span>{workflows.length} 个流程 · {workflows.filter((workflow) => workflow.enabled).length} 个启用</span></div></div>
				<button type="button" className="loop-primary-action" onClick={create}><Plus size={15} />新建 Loop</button>
			</header>

			<div className="loop-dashboard-toolbar">
				<label className="loop-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Loop" /></label>
				<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Loop 筛选">
					<option value="all">全部流程</option><option value="enabled">已启用</option><option value="schedule">定时调度</option><option value="event">事件触发</option>
				</select>
				<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Loop 排序">
					<option value="updated">最近修改</option><option value="created">最近创建</option><option value="name">名称</option>
				</select>
			</div>

			<div className="loop-table">
				<div className="loop-table-head"><span>名称</span><span>类型</span><span>触发</span><span>节点</span><span>状态</span><span>更新时间</span><span /></div>
				<div className="loop-table-body">
					{loading && <div className="loop-dashboard-empty"><Clock3 size={20} /><strong>正在加载 Loop</strong></div>}
					{!loading && visibleWorkflows.map((workflow) => (
						<LoopRow key={workflow.id} workflow={workflow}
							onOpen={() => history.push(`${ROUTES.AI_LOOPS}/${workflow.id}`)}
							onAction={(action) => handleAction(workflow, action)} />
					))}
					{!loading && !visibleWorkflows.length && (
						<div className="loop-dashboard-empty"><GitBranch size={22} /><strong>{workflows.length ? '没有匹配的 Loop' : '还没有 Loop'}</strong></div>
					)}
				</div>
			</div>
		</div>
	);
}

import './AgentWorkspace.styles.scss';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { Modal } from 'antd';
import {
	AGENT_BASE_URL,
	agentApi,
	AgentMode,
	AgentModelSettings,
	AgentThread,
	WorkflowRecord,
} from 'api/agent/client';
import {
	AlertCircle,
	Archive,
	ArrowDown,
	Bot,
	Box,
	BrainCircuit,
	Check,
	Circle,
	ClipboardCheck,
	Copy,
	FileSearch,
	FileText,
	ListTodo,
	Loader2,
	MessageSquare,
	PanelRight,
	Paperclip,
	Plus,
	RotateCcw,
	Search,
	Send,
	ShieldCheck,
	Sparkles,
	Square,
	Trash2,
	X,
} from 'lucide-react';
import {
	KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { AppState } from 'store/reducers';
import AppReducer from 'types/reducer/app';

import EvidenceInspector from './EvidenceInspector';
import MemoryInspector from './MemoryInspector';
import MastraMessagePart, {
	isToolPart,
	partData,
	partRecord,
} from './MastraMessagePart';

const OUTPUT_AVAILABLE = 'output-available';

type InspectorTab = 'execution' | 'evidence' | 'memory' | 'artifacts' | 'approvals';

const modeLabels: Record<AgentMode, string> = {
	diagnose: '诊断',
	plan: '规划',
	operate: '操作',
};

const starterTasks = [
	'检查最近 30 分钟有哪些服务异常，并列出关键证据',
	'查看当前告警，按影响范围给出处理优先级',
	'分析服务列表并建议下一步应检查的指标、日志或链路',
];

function mastraPartKey(
	messageId: string,
	part: UIMessage['parts'][number],
	partIndex = 0,
): string {
	const record = partRecord(part);
	const identity =
		record.id ||
		record.toolCallId ||
		record.sourceId ||
		record.url ||
		`${part.type}-${partIndex}`;
	return `${messageId}-${String(identity)}`;
}

function uiMessageText(message: UIMessage): string {
	return message.parts
		.flatMap((part) => (part.type === 'text' ? [part.text] : []))
		.join('\n')
		.trim();
}

function hasStreamingPart(message: UIMessage | undefined): boolean {
	if (!message) return false;
	return message.parts.some((part) => {
		if (part.type === 'text' || part.type === 'reasoning')
			return part.state === 'streaming';
		if (!isToolPart(part)) return false;
		const state = String(partRecord(part).state || '');
		return state !== OUTPUT_AVAILABLE && state !== 'output-error';
	});
}

interface ChatRequestState {
	activeThread: string;
	mode: AgentMode;
	token: string;
	workflowId: string;
}

function isAgentResumeBody(body: BodyInit | null | undefined): boolean {
	if (typeof body !== 'string') return false;
	try {
		const value = JSON.parse(body) as Record<string, unknown>;
		return Boolean(value.runId && value.resumeData);
	} catch {
		return false;
	}
}

function createAgentTransport(requestRef: {
	current: ChatRequestState;
}): DefaultChatTransport<UIMessage> {
	return new DefaultChatTransport<UIMessage>({
		api: `${AGENT_BASE_URL}/api/chat`,
		fetch: async (_input, init): Promise<Response> => {
			const { current } = requestRef;
			const url =
				current.workflowId && !isAgentResumeBody(init?.body)
					? `${AGENT_BASE_URL}/api/workflows/${current.workflowId}/stream`
					: `${AGENT_BASE_URL}/api/chat`;
			return fetch(url, init);
		},
		headers: (): Record<string, string> => ({
			Authorization: `Bearer ${requestRef.current.token}`,
		}),
		prepareSendMessagesRequest: ({
			messages: requestMessages,
			body,
			trigger,
		}): { body: Record<string, unknown> } => {
			const { current } = requestRef;
			const last = requestMessages[requestMessages.length - 1];
			const text = last ? uiMessageText(last) : '';
			if (body?.resumeData && body?.runId) {
				return {
					body: {
						threadId: current.activeThread,
						mode: current.mode,
						messages: requestMessages,
						runId: body.runId,
						resumeData: body.resumeData,
						trigger,
					},
				};
			}
			return current.workflowId
				? {
						body: {
							threadId: current.activeThread,
							inputData: { message: text },
						},
				  }
				: {
						body: {
							threadId: current.activeThread,
							mode: current.mode,
							messages: [last],
							trigger,
						},
				  };
		},
	});
}

// The workspace owns the task list, persistent transcript, live stream and inspector state as one interaction surface.
// eslint-disable-next-line sonarjs/cognitive-complexity
export default function AgentWorkspace(): JSX.Element {
	const location = useLocation();
	const { user } = useSelector<AppState, AppReducer>((state) => state.app);
	const token = user?.accessJwt || '';
	const [threads, setThreads] = useState<AgentThread[]>([]);
	const [activeThread, setActiveThread] = useState('');
	const [settings, setSettings] = useState<AgentModelSettings | null>(null);
	const [input, setInput] = useState('');
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [search, setSearch] = useState('');
	const [mode, setMode] = useState<AgentMode>('diagnose');
	const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
	const [workflowId, setWorkflowId] = useState('');
	const [inspectorTab, setInspectorTab] = useState<InspectorTab>('execution');
	const [localError, setLocalError] = useState('');
	const [isNearBottom, setIsNearBottom] = useState(true);
	const [showPending, setShowPending] = useState(false);
	const [copiedMessageId, setCopiedMessageId] = useState('');
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const messagesRef = useRef<HTMLDivElement>(null);
	const chatRequestRef = useRef<ChatRequestState>({
		activeThread,
		mode,
		token,
		workflowId,
	});
	chatRequestRef.current = { activeThread, mode, token, workflowId };

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const requestedWorkflow = params.get('workflowId');
		const requestedInput = params.get('input');
		if (requestedWorkflow) setWorkflowId(requestedWorkflow);
		if (requestedInput) setInput(requestedInput);
	}, [location.search]);

	const transport = useMemo(() => createAgentTransport(chatRequestRef), []);
	const {
		messages,
		setMessages,
		sendMessage: sendChatMessage,
		status,
		stop,
		regenerate,
		error: chatError,
		clearError,
	} = useChat<UIMessage>({ id: activeThread || 'scry-new-thread', transport });
	const running = status === 'submitted' || status === 'streaming';
	const lastMessage = messages[messages.length - 1];

	const loadThreads = useCallback(async (): Promise<AgentThread[]> => {
		if (!token) return [];
		let list = await agentApi.listThreads(token);
		if (!list.length) {
			const created = await agentApi.createThread(token);
			list = await agentApi.listThreads(token);
			setActiveThread(created.id);
		}
		setThreads(list);
		setActiveThread((current) => current || list[0]?.id || '');
		return list;
	}, [token]);

	const reloadActiveThread = useCallback(async (): Promise<void> => {
		if (!activeThread || !token) return;
		const detail = await agentApi.getThread(token, activeThread);
		setMessages(detail.uiMessages as UIMessage[]);
	}, [activeThread, setMessages, token]);

	useEffect((): void => {
		loadThreads().catch((e) => setLocalError(e.message));
		agentApi
			.getModelSettings(token)
			.then(setSettings)
			.catch(() => undefined);
		agentApi
			.listWorkflows(token, true)
			.then(setWorkflows)
			.catch(() => undefined);
	}, [loadThreads, token]);

	useEffect(() => {
		if (!activeThread || !token) return;
		setLocalError('');
		clearError();
		reloadActiveThread().catch((e) => setLocalError(e.message));
	}, [activeThread, clearError, reloadActiveThread, token]);

	useEffect(() => {
		if (
			!running ||
			(lastMessage?.role === 'assistant' && hasStreamingPart(lastMessage))
		) {
			setShowPending(false);
			return undefined;
		}
		const timeout = window.setTimeout(() => setShowPending(true), 300);
		return (): void => window.clearTimeout(timeout);
	}, [lastMessage, running]);

	useEffect((): (() => void) | undefined => {
		if (!isNearBottom) return undefined;
		const frame = window.requestAnimationFrame(() => {
			const viewport = messagesRef.current;
			if (viewport) viewport.scrollTop = viewport.scrollHeight;
		});
		return (): void => window.cancelAnimationFrame(frame);
	}, [isNearBottom, messages, showPending]);

	useEffect((): (() => void) => {
		setIsNearBottom(true);
		const frame = window.requestAnimationFrame(() => {
			const viewport = messagesRef.current;
			if (viewport) viewport.scrollTop = viewport.scrollHeight;
		});
		return (): void => window.cancelAnimationFrame(frame);
	}, [activeThread]);

	useEffect((): void => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
		textarea.style.overflowY = textarea.scrollHeight > 220 ? 'auto' : 'hidden';
	}, [input]);

	const activeThreadData = threads.find((thread) => thread.id === activeThread);
	const filteredThreads = useMemo(
		() =>
			threads.filter((thread) =>
				thread.title.toLowerCase().includes(search.trim().toLowerCase()),
			),
		[search, threads],
	);
	const todayStart = new Date().setHours(0, 0, 0, 0);
	const threadGroups = useMemo(
		() => [
			{
				label: '今天',
				items: filteredThreads.filter((thread) => thread.updated_at >= todayStart),
			},
			{
				label: '更早',
				items: filteredThreads.filter((thread) => thread.updated_at < todayStart),
			},
		],
		[filteredThreads, todayStart],
	);

	const mastraParts = useMemo(
		() => messages.flatMap((message) => message.parts),
		[messages],
	);
	const fileParts = mastraParts.filter((part) => part.type === 'file');
	const standardApprovalParts = mastraParts.filter((part) => {
		const data = partData(part);
		const state = String(partRecord(part).state || '');
		return (
			part.type === 'data-tool-call-approval' ||
			part.type === 'data-tool-call-suspended' ||
			(part.type === 'data-scry-workflow-step' && data.status === 'suspended') ||
			state === 'approval-requested'
		);
	});
	const liveExecutionParts = useMemo(
		() =>
			mastraParts.filter(
				(part) =>
					isToolPart(part) ||
					part.type === 'data-workflow' ||
					part.type === 'data-tool-workflow' ||
					part.type === 'data-workflow-step' ||
					part.type === 'data-tool-workflow-step' ||
					part.type === 'data-scry-workflow-step' ||
					part.type === 'data-network' ||
					part.type === 'data-tool-network',
			),
		[mastraParts],
	);

	const createNewThread = async (): Promise<void> => {
		const created = await agentApi.createThread(token);
		await loadThreads();
		setActiveThread(created.id);
		setMessages([]);
		setLocalError('');
		clearError();
	};

	const deleteThread = (threadId: string): void => {
		Modal.confirm({
			title: '删除任务',
			content: '这个任务的对话和执行记录也会被删除。',
			okText: '删除',
			cancelText: '取消',
			okButtonProps: { danger: true },
			onOk: async () => {
				await agentApi.deleteThread(token, threadId);
				const list = await loadThreads();
				if (threadId === activeThread) setActiveThread(list[0]?.id || '');
			},
		});
	};

	const sendMessage = async (explicitMessage?: string): Promise<void> => {
		const message = (explicitMessage ?? input).trim();
		const files = fileInputRef.current?.files;
		if (
			(!message && (!files?.length || Boolean(workflowId))) ||
			!activeThread ||
			running
		)
			return;
		setInput('');
		setLocalError('');
		clearError();
		setInspectorTab('execution');
		try {
			await sendChatMessage({
				text: message,
				...(files?.length ? { files } : {}),
			});
			if (fileInputRef.current) fileInputRef.current.value = '';
			setPendingFiles([]);
			await loadThreads();
		} catch (e) {
			if (!(e instanceof DOMException && e.name === 'AbortError'))
				setLocalError(e instanceof Error ? e.message : '发送失败');
		}
	};

	const selectFiles = (files: FileList | null): void => {
		const selectedFiles = Array.from(files || []);
		const nextFiles = [...pendingFiles, ...selectedFiles].filter(
			(file, index, all) =>
				all.findIndex(
					(candidate) =>
						candidate.name === file.name &&
						candidate.size === file.size &&
						candidate.lastModified === file.lastModified,
				) === index,
		);
		if (nextFiles.length > 5) {
			setLocalError('一次最多添加 5 个附件');
			return;
		}
		if (nextFiles.some((file) => file.size > 10 * 1024 * 1024)) {
			setLocalError('单个附件不能超过 10 MB');
			return;
		}
		if (
			nextFiles.some(
				(file) =>
					/\.(?:txt|md|markdown|json|log|csv)$/i.test(file.name) &&
					file.size > 512 * 1024,
			)
		) {
			setLocalError('文本附件不能超过 512 KB');
			return;
		}
		const transfer = new DataTransfer();
		nextFiles.forEach((file) => transfer.items.add(file));
		if (fileInputRef.current) fileInputRef.current.files = transfer.files;
		setPendingFiles(nextFiles);
		setLocalError('');
	};

	const selectWorkflow = (nextWorkflowId: string): void => {
		setWorkflowId(nextWorkflowId);
		if (!nextWorkflowId || !pendingFiles.length) return;
		setPendingFiles([]);
		if (fileInputRef.current) fileInputRef.current.value = '';
		setLocalError('Loop 当前仅支持文本输入，已移除待发送附件');
	};

	const removePendingFile = (index: number): void => {
		const transfer = new DataTransfer();
		pendingFiles.forEach((file, fileIndex) => {
			if (fileIndex !== index) transfer.items.add(file);
		});
		if (fileInputRef.current) fileInputRef.current.files = transfer.files;
		setPendingFiles(Array.from(transfer.files));
	};

	const stopRun = (): void => {
		stop();
	};

	const retryLast = (messageId?: string): void => {
		regenerate(messageId ? { messageId } : undefined).catch((error) =>
			setLocalError(error instanceof Error ? error.message : '重新生成失败'),
		);
	};

	const copyMessage = async (message: UIMessage): Promise<void> => {
		const text = uiMessageText(message);
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			setCopiedMessageId(message.id);
			window.setTimeout(() => setCopiedMessageId(''), 1500);
		} catch {
			setLocalError('复制失败，请检查浏览器剪贴板权限');
		}
	};

	const updateScrollPosition = (): void => {
		const viewport = messagesRef.current;
		if (!viewport) return;
		setIsNearBottom(
			viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96,
		);
	};

	const scrollToBottom = (): void => {
		setIsNearBottom(true);
		messagesRef.current?.scrollTo({
			top: messagesRef.current.scrollHeight,
			behavior: 'smooth',
		});
	};

	const respondToAgentTool = async (
		runId: string,
		approved: boolean,
	): Promise<void> => {
		if (!runId || running) return;
		setLocalError('');
		setInspectorTab('execution');
		try {
			await regenerate({ body: { runId, resumeData: { approved } } });
		} catch (error) {
			setLocalError(error instanceof Error ? error.message : '工具审批失败');
		}
	};

	const resumeWorkflowRun = async (
		runId: string,
		approved: boolean,
	): Promise<void> => {
		setLocalError('');
		try {
			const response = await fetch(
				`${AGENT_BASE_URL}/api/workflow-runs/${runId}/resume`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ approved }),
				},
			);
			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				throw new Error(body.error || '审批失败');
			}
			await response.text();
			const detail = await agentApi.getThread(token, activeThread);
			setMessages(detail.uiMessages as UIMessage[]);
		} catch (error) {
			setLocalError(error instanceof Error ? error.message : '审批失败');
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
		if (event.nativeEvent.isComposing || event.keyCode === 229) return;
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	};

	return (
		<div className="agent-workspace">
			<aside className="agent-threads">
				<div className="agent-panel-header">
					<div>
						<strong>任务</strong>
						<span>{threads.length}</span>
					</div>
					<button
						type="button"
						className="agent-icon-button"
						onClick={createNewThread}
						title="新建任务"
						aria-label="新建任务"
					>
						<Plus size={18} />
					</button>
				</div>
				<div className="agent-thread-search">
					<Search size={14} />
					<input
						value={search}
						onChange={(event): void => setSearch(event.target.value)}
						placeholder="搜索任务"
					/>
				</div>
				<div className="agent-thread-list">
					{threadGroups.map(
						(group) =>
							group.items.length > 0 && (
								<div className="agent-thread-group" key={group.label}>
									<div className="agent-thread-group-label">{group.label}</div>
									{group.items.map((thread) => (
										<div
											className={`agent-thread-item ${
												activeThread === thread.id ? 'active' : ''
											}`}
											key={thread.id}
										>
											<button
												type="button"
												className="agent-thread-select"
												onClick={(): void => setActiveThread(thread.id)}
											>
												<MessageSquare size={14} />
												<span>{thread.title}</span>
											</button>
											<button
												type="button"
												className="agent-thread-delete"
												title="删除任务"
												aria-label="删除任务"
												onClick={(): void => deleteThread(thread.id)}
											>
												<Trash2 size={13} />
											</button>
										</div>
									))}
								</div>
							),
					)}
					{!filteredThreads.length && (
						<div className="agent-list-empty">没有匹配的任务</div>
					)}
				</div>
			</aside>

			<main className="agent-chat">
				<header className="agent-chat-header">
					<div className="agent-task-title">
						<h2>{activeThreadData?.title || 'Scry Agent'}</h2>
						<span>
							{settings?.model || '未配置模型'} ·{' '}
							{settings?.provider === 'anthropic' ? 'Messages API' : 'Responses API'}
						</span>
					</div>
					<div className={`agent-run-status ${running ? 'running' : ''}`}>
						{running ? (
							<Loader2 className="agent-spin" size={14} />
						) : (
							<Circle size={10} />
						)}
						{running ? '正在执行' : '就绪'}
					</div>
				</header>

				<div
					className="agent-messages"
					ref={messagesRef}
					onScroll={updateScrollPosition}
				>
					{!messages.length && (
						<div className="agent-welcome">
							<div className="agent-welcome-icon">
								<Sparkles size={24} />
							</div>
							<h2>从真实系统信号开始</h2>
							<p>
								Agent 会先形成计划，再调用 Scry
								的只读工具收集证据。所有执行过程都可在右侧检查。
							</p>
							<div className="agent-starters">
								{starterTasks.map((task) => (
									<button
										type="button"
										key={task}
										onClick={(): void => {
											setInput(task);
										}}
									>
										{task}
									</button>
								))}
							</div>
						</div>
					)}
					{messages.map((message) => (
						<div className={`agent-message ${message.role}`} key={message.id}>
							{message.role === 'assistant' && (
								<span className="agent-avatar">
									<Bot size={16} />
								</span>
							)}
							<div className="agent-message-body">
								<div className="agent-message-content">
									{message.parts.map((part, partIndex) => (
										<MastraMessagePart
											key={mastraPartKey(message.id, part, partIndex)}
											part={part}
											partKey={mastraPartKey(message.id, part, partIndex)}
											onToolApproval={respondToAgentTool}
											onWorkflowApproval={resumeWorkflowRun}
										/>
									))}
								</div>
								{uiMessageText(message) && (
									<div className="agent-message-actions">
										<button
											type="button"
											title="复制消息"
											aria-label="复制消息"
											onClick={(): void => {
												copyMessage(message);
											}}
										>
											{copiedMessageId === message.id ? (
												<Check size={13} />
											) : (
												<Copy size={13} />
											)}
										</button>
										{message.role === 'assistant' && (
											<button
												type="button"
												title="重新生成"
												aria-label="重新生成"
												disabled={running}
												onClick={(): void => retryLast(message.id)}
											>
												<RotateCcw size={13} />
											</button>
										)}
									</div>
								)}
							</div>
						</div>
					))}
					{showPending && (
						<div className="agent-pending-indicator" aria-label="Agent 正在处理">
							<span />
							<span />
							<span />
						</div>
					)}
					{(localError || chatError) && (
						<div className="agent-inline-error">
							<AlertCircle size={17} />
							<span>{localError || chatError?.message}</span>
							<button type="button" onClick={(): void => retryLast()}>
								<RotateCcw size={14} />
								重试
							</button>
						</div>
					)}
				</div>
				{!isNearBottom && (
					<button
						type="button"
						className="agent-scroll-bottom"
						title="回到最新消息"
						aria-label="回到最新消息"
						onClick={scrollToBottom}
					>
						<ArrowDown size={16} />
					</button>
				)}

				<div className="agent-composer-wrap">
					<div className="agent-composer">
						<textarea
							ref={textareaRef}
							value={input}
							onChange={(event): void => setInput(event.target.value)}
							onKeyDown={onKeyDown}
							placeholder="描述要诊断的问题，或让 Agent 制定执行计划..."
						/>
						{pendingFiles.length > 0 && (
							<div className="agent-pending-files">
								{pendingFiles.map((file, index) => (
									<span key={`${file.name}-${file.lastModified}`}>
										<FileText size={12} />
										<strong>{file.name}</strong>
										<small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
										<button
											type="button"
											aria-label={`移除 ${file.name}`}
											onClick={(): void => removePendingFile(index)}
										>
											<X size={12} />
										</button>
									</span>
								))}
							</div>
						)}
						<div className="agent-composer-actions">
							<input
								ref={fileInputRef}
								type="file"
								className="agent-file-input"
								multiple
								accept="image/*,.txt,.md,.json,.log,.csv,application/pdf"
								onChange={(event): void => selectFiles(event.target.files)}
							/>
							<button
								type="button"
								className="agent-attach"
								disabled={Boolean(workflowId)}
								title={workflowId ? 'Loop 当前仅支持文本输入' : '添加附件'}
								aria-label={workflowId ? 'Loop 当前仅支持文本输入' : '添加附件'}
								onClick={(): void => fileInputRef.current?.click()}
							>
								<Paperclip size={15} />
							</button>
							<div className="agent-mode-select agent-workflow-select">
								<select
									value={workflowId}
									onChange={(event): void => selectWorkflow(event.target.value)}
									aria-label="选择 Loop"
								>
									<option value="">普通对话</option>
									{workflows.map((workflow) => (
										<option value={workflow.id} key={workflow.id}>
											{workflow.name}
										</option>
									))}
								</select>
								<span>
									{workflowId
										? workflows.find((workflow) => workflow.id === workflowId)?.name
										: '普通对话'}
								</span>
							</div>
							<div className="agent-mode-select">
								<select
									value={mode}
									onChange={(event): void => setMode(event.target.value as AgentMode)}
									aria-label="Agent 模式"
								>
									<option value="diagnose">诊断模式</option>
									<option value="plan">规划模式</option>
									<option value="operate">操作模式</option>
								</select>
								<span>{modeLabels[mode]}</span>
							</div>
							<span className="agent-composer-model">
								{settings?.model || '模型未配置'}
							</span>
							{running ? (
								<button
									type="button"
									className="agent-stop"
									onClick={stopRun}
									title="停止执行"
									aria-label="停止执行"
								>
									<Square size={15} />
								</button>
							) : (
								<button
									type="button"
									className="agent-send"
									disabled={
										!input.trim() && (Boolean(workflowId) || !pendingFiles.length)
									}
									onClick={(): void => {
										sendMessage();
									}}
									title="发送"
									aria-label="发送"
								>
									<Send size={16} />
								</button>
							)}
						</div>
					</div>
				</div>
			</main>

			<aside className="agent-inspector">
				<div className="agent-inspector-heading">
					<div>
						<PanelRight size={16} />
						<strong>任务检查器</strong>
					</div>
					<span>{liveExecutionParts.length}</span>
				</div>
				<div className="agent-inspector-tabs">
					<button
						type="button"
						className={inspectorTab === 'execution' ? 'active' : ''}
						onClick={(): void => setInspectorTab('execution')}
					>
						<ListTodo size={14} />
						执行
					</button>
					<button
						type="button"
						className={inspectorTab === 'evidence' ? 'active' : ''}
						onClick={(): void => setInspectorTab('evidence')}
					>
						<FileSearch size={14} />
						证据
					</button>
						<button
							type="button"
							className={inspectorTab === 'artifacts' ? 'active' : ''}
						onClick={(): void => setInspectorTab('artifacts')}
					>
						<Box size={14} />
							产物
						</button>
						<button
							type="button"
							className={inspectorTab === 'memory' ? 'active' : ''}
							onClick={(): void => setInspectorTab('memory')}
						>
							<BrainCircuit size={14} />
							记忆
						</button>
					<button
						type="button"
						className={inspectorTab === 'approvals' ? 'active' : ''}
						onClick={(): void => setInspectorTab('approvals')}
					>
						<ClipboardCheck size={14} />
						审批
					</button>
				</div>
				<div className="agent-inspector-body">
					{inspectorTab === 'execution' && (
						<>
							{liveExecutionParts.map((part, index) => (
								<MastraMessagePart
									key={mastraPartKey('inspector', part, index)}
									part={part}
									partKey={mastraPartKey('inspector', part, index)}
									onToolApproval={respondToAgentTool}
									onWorkflowApproval={resumeWorkflowRun}
								/>
							))}
							{!liveExecutionParts.length && (
								<div className="agent-inspector-empty">
									<ListTodo size={24} />
									<strong>尚未开始执行</strong>
									<span>计划、步骤和工具状态会实时显示在这里。</span>
								</div>
							)}
						</>
					)}
					{inspectorTab === 'evidence' && (
						<EvidenceInspector
							token={token}
							threadId={activeThread}
							refreshKey={`${status}:${messages.length}`}
							busy={running}
							onRevisionComplete={reloadActiveThread}
							onError={setLocalError}
						/>
					)}
					{inspectorTab === 'memory' && (
						<MemoryInspector
							token={token}
							threadId={activeThread}
							refreshKey={`${status}:${messages.length}`}
							busy={running}
							onError={setLocalError}
						/>
					)}
					{inspectorTab === 'artifacts' && (
						<>
							{fileParts.map((part) => {
								const record = partRecord(part);
								return (
									<a
										className="agent-artifact"
										href={String(record.url)}
										target="_blank"
										rel="noreferrer"
										key={mastraPartKey('artifact', part)}
									>
										<FileText size={16} />
										<div>
											<strong>{String(record.filename || '模型文件')}</strong>
											<span>{String(record.mediaType || '')}</span>
										</div>
									</a>
								);
							})}
							{!fileParts.length && (
								<div className="agent-inspector-empty">
									<Archive size={24} />
									<strong>暂无产物</strong>
									<span>模型生成的图片和文件会集中保存在这里。</span>
								</div>
							)}
						</>
					)}
					{inspectorTab === 'approvals' && (
						<>
							{standardApprovalParts.map((part) => (
								<MastraMessagePart
									key={mastraPartKey('approval', part)}
									part={part}
									partKey={mastraPartKey('approval', part)}
									onToolApproval={respondToAgentTool}
									onWorkflowApproval={resumeWorkflowRun}
								/>
							))}
							{!standardApprovalParts.length && (
								<div className="agent-inspector-empty">
									<ShieldCheck size={24} />
									<strong>无需审批</strong>
									<span>当前仅启用只读查询；有副作用的工具将在这里等待确认。</span>
								</div>
							)}
						</>
					)}
				</div>
			</aside>
		</div>
	);
}

import './AgentSettings.styles.scss';

import {
	agentApi,
	AgentModelSettings,
	AgentModelTestResult,
} from 'api/agent/client';
import { useNotifications } from 'hooks/useNotifications';
import {
	Bot,
	Brain,
	CheckCircle2,
	CircleAlert,
	Cpu,
	KeyRound,
	Loader2,
	MemoryStick,
	ShieldCheck,
	SlidersHorizontal,
	TestTube2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'store/reducers';
import AppReducer from 'types/reducer/app';

import MCPPluginSettings from './MCPPluginSettings';
import SecurityAuditTimeline from './SecurityAuditTimeline';
import SSHSecuritySettings from './SSHSecuritySettings';

type SettingsTab = 'model' | 'agent' | 'memory' | 'security';

const defaults: AgentModelSettings = {
	provider: 'openai',
	endpointMode: 'official',
	model: 'gpt-4o-mini',
	baseUrl: '',
	hasApiKey: false,
	temperature: null,
	maxOutputTokens: 8192,
	maxSteps: 8,
	timeoutSeconds: 120,
	maxRetries: 1,
	toolChoice: 'auto',
	instructions: '',
	memoryLastMessages: 30,
};

const tabItems: Array<{ id: SettingsTab; label: string; icon: JSX.Element }> = [
	{ id: 'model', label: '模型', icon: <Cpu size={15} /> },
	{ id: 'agent', label: 'Agent', icon: <Bot size={15} /> },
	{ id: 'memory', label: '记忆', icon: <Brain size={15} /> },
	{ id: 'security', label: '工具与安全', icon: <ShieldCheck size={15} /> },
];

function endpointFor(settings: AgentModelSettings): string {
	const official =
		settings.provider === 'openai'
			? 'https://api.openai.com/v1'
			: 'https://api.anthropic.com/v1';
	const base =
		settings.endpointMode === 'official'
			? official
			: settings.baseUrl.trim().replace(/\/+$/, '');
	if (!base) return '请先填写自定义 Base URL';
	const normalized =
		settings.provider === 'openai'
			? base.replace(/\/responses$/, '')
			: base.replace(/\/messages$/, '');
	return `${normalized}/${
		settings.provider === 'openai' ? 'responses' : 'messages'
	}`;
}

// This page intentionally coordinates persisted settings, live validation and four configuration surfaces.
// eslint-disable-next-line sonarjs/cognitive-complexity
export default function AgentSettings(): JSX.Element {
	const { user } = useSelector<AppState, AppReducer>((state) => state.app);
	const { notifications } = useNotifications();
	const [activeTab, setActiveTab] = useState<SettingsTab>('model');
	const [settings, setSettings] = useState(defaults);
	const [apiKey, setApiKey] = useState('');
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<AgentModelTestResult | null>(
		null,
	);

	useEffect(() => {
		if (user?.accessJwt)
			agentApi
				.getModelSettings(user.accessJwt)
				.then(setSettings)
				.catch((error) => notifications.error({ message: error.message }));
	}, [notifications, user?.accessJwt]);

	const endpoint = useMemo(() => endpointFor(settings), [settings]);
	const canTest = Boolean(
		settings.model.trim() &&
			(apiKey.trim() || settings.hasApiKey) &&
			(settings.endpointMode === 'official' || settings.baseUrl.trim()),
	);

	const save = async (): Promise<void> => {
		setSaving(true);
		try {
			const next = await agentApi.updateModelSettings(user?.accessJwt || '', {
				...settings,
				apiKey: apiKey || undefined,
			});
			setSettings(next);
			setApiKey('');
			notifications.success({ message: 'AI 设置已保存' });
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : '保存失败',
			});
		} finally {
			setSaving(false);
		}
	};

	const test = async (): Promise<void> => {
		setTesting(true);
		setTestResult(null);
		try {
			const result = await agentApi.testModel(user?.accessJwt || '', {
				...settings,
				apiKey: apiKey || undefined,
			});
			setTestResult(result);
			if (result.ok) notifications.success({ message: '模型连接成功' });
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : '连接测试失败',
			});
		} finally {
			setTesting(false);
		}
	};

	const changeProvider = (provider: 'openai' | 'anthropic'): void => {
		setTestResult(null);
		setSettings((current) => ({
			...current,
			provider,
			endpointMode: 'official',
			baseUrl: '',
			model: provider === 'openai' ? 'gpt-4o-mini' : 'claude-opus-4-8',
		}));
	};

	return (
		<div className="agent-settings">
			<div className="agent-settings-heading">
				<div>
					<h2>AI 设置</h2>
					<p>配置模型连接、Agent 执行边界、记忆窗口和工具策略。</p>
				</div>
				<div className="agent-settings-save-state">
					{settings.hasApiKey ? <KeyRound size={14} /> : <CircleAlert size={14} />}
					{settings.hasApiKey ? '密钥已保存' : '尚未保存密钥'}
				</div>
			</div>

			<div className="agent-settings-tabs" role="tablist">
				{tabItems.map((tab) => (
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === tab.id}
						className={activeTab === tab.id ? 'active' : ''}
						key={tab.id}
						onClick={(): void => setActiveTab(tab.id)}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>

			{activeTab === 'model' && (
				<div className="agent-settings-content">
					<section className="agent-settings-section">
						<div className="agent-section-title">
							<div>
								<h3>模型连接</h3>
								<p>OpenAI 始终使用 Responses API；兼容端点必须实现该接口。</p>
							</div>
							<span className="agent-protocol-badge">
								{settings.provider === 'openai' ? 'Responses API' : 'Messages API'}
							</span>
						</div>
						<div className="agent-settings-grid">
							<div className="agent-settings-field">
								<label htmlFor="agent-provider">API 协议</label>
								<select
									id="agent-provider"
									value={settings.provider}
									onChange={(event): void =>
										changeProvider(event.target.value as 'openai' | 'anthropic')
									}
								>
									<option value="openai">OpenAI Responses</option>
									<option value="anthropic">Anthropic Messages</option>
								</select>
							</div>
							<div className="agent-settings-field">
								<label htmlFor="agent-model">模型 ID</label>
								<input
									id="agent-model"
									value={settings.model}
									onChange={(event): void =>
										setSettings({ ...settings, model: event.target.value })
									}
								/>
							</div>
							<div className="agent-settings-field full">
								<span className="agent-field-label">端点类型</span>
								<div className="agent-segmented">
									<button
										type="button"
										className={settings.endpointMode === 'official' ? 'active' : ''}
										onClick={(): void =>
											setSettings({ ...settings, endpointMode: 'official' })
										}
									>
										官方端点
									</button>
									<button
										type="button"
										className={settings.endpointMode === 'custom' ? 'active' : ''}
										onClick={(): void =>
											setSettings({ ...settings, endpointMode: 'custom' })
										}
									>
										兼容端点
									</button>
								</div>
							</div>
							{settings.endpointMode === 'custom' && (
								<div className="agent-settings-field full">
									<label htmlFor="agent-base-url">Base URL</label>
									<input
										id="agent-base-url"
										value={settings.baseUrl}
										onChange={(event): void =>
											setSettings({ ...settings, baseUrl: event.target.value })
										}
										placeholder="https://your-provider.example/v1"
									/>
									<span className="agent-field-hint">
										可以填写 API 根路径或完整接口地址，系统会自动规范化。
									</span>
								</div>
							)}
							<div className="agent-settings-field full">
								<label htmlFor="agent-api-key">API Key</label>
								<input
									id="agent-api-key"
									type="password"
									value={apiKey}
									onChange={(event): void => setApiKey(event.target.value)}
									placeholder={
										settings.hasApiKey ? '已保存，留空则保持不变' : '输入 API Key'
									}
								/>
								<span className="agent-field-hint">
									密钥经 AES-GCM 加密保存，页面不会读取明文。
								</span>
							</div>
						</div>

						<div className="agent-endpoint-preview">
							<span>实际请求</span>
							<code>{endpoint}</code>
						</div>

						<div className="agent-settings-actions">
							<button
								type="button"
								className="primary"
								disabled={saving || !settings.model.trim()}
								onClick={save}
							>
								{saving ? (
									<Loader2 className="agent-spin" size={15} />
								) : (
									<CheckCircle2 size={15} />
								)}
								{saving ? '保存中' : '保存设置'}
							</button>
							<button type="button" disabled={testing || !canTest} onClick={test}>
								{testing ? (
									<Loader2 className="agent-spin" size={15} />
								) : (
									<TestTube2 size={15} />
								)}
								{testing ? '测试中' : '测试当前配置'}
							</button>
						</div>

						{testResult && (
							<div
								className={`agent-test-result ${testResult.ok ? 'success' : 'failed'}`}
							>
								<div className="agent-test-result-heading">
									{testResult.ok ? (
										<CheckCircle2 size={18} />
									) : (
										<CircleAlert size={18} />
									)}
									<div>
										<strong>{testResult.message}</strong>
										<span>
											{testResult.protocol} · {testResult.model} · {testResult.latencyMs}{' '}
											ms
										</span>
									</div>
								</div>
								<code>{testResult.endpoint}</code>
							</div>
						)}
					</section>

					<section className="agent-settings-section">
						<div className="agent-section-title">
							<div>
								<h3>生成参数</h3>
								<p>这些值已接入 Mastra 每次模型执行。</p>
							</div>
							<SlidersHorizontal size={17} />
						</div>
						<div className="agent-settings-grid three">
							<label className="agent-settings-field">
								温度
								<input
									type="number"
									min="0"
									max="2"
									step="0.1"
									value={settings.temperature ?? ''}
									placeholder="模型默认"
									onChange={(event): void =>
										setSettings({
											...settings,
											temperature:
												event.target.value === '' ? null : Number(event.target.value),
										})
									}
								/>
							</label>
							<label className="agent-settings-field">
								最大输出 Token
								<input
									type="number"
									min="64"
									max="128000"
									value={settings.maxOutputTokens}
									onChange={(event): void =>
										setSettings({
											...settings,
											maxOutputTokens: Number(event.target.value),
										})
									}
								/>
							</label>
							<label className="agent-settings-field">
								最大步骤
								<input
									type="number"
									min="1"
									max="50"
									value={settings.maxSteps}
									onChange={(event): void =>
										setSettings({ ...settings, maxSteps: Number(event.target.value) })
									}
								/>
							</label>
							<label className="agent-settings-field">
								超时（秒）
								<input
									type="number"
									min="10"
									max="1800"
									value={settings.timeoutSeconds}
									onChange={(event): void =>
										setSettings({
											...settings,
											timeoutSeconds: Number(event.target.value),
										})
									}
								/>
							</label>
							<label className="agent-settings-field">
								失败重试
								<input
									type="number"
									min="0"
									max="10"
									value={settings.maxRetries}
									onChange={(event): void =>
										setSettings({ ...settings, maxRetries: Number(event.target.value) })
									}
								/>
							</label>
							<label className="agent-settings-field">
								工具选择
								<select
									value={settings.toolChoice}
									onChange={(event): void =>
										setSettings({
											...settings,
											toolChoice: event.target.value as AgentModelSettings['toolChoice'],
										})
									}
								>
									<option value="auto">自动</option>
									<option value="none">禁用工具</option>
									<option value="required">必须调用工具</option>
								</select>
							</label>
						</div>
					</section>
				</div>
			)}

			{activeTab === 'agent' && (
				<div className="agent-settings-content">
					<section className="agent-settings-section">
						<div className="agent-section-title">
							<div>
								<h3>Agent 指令</h3>
								<p>追加到 Scry 内置的中文诊断与安全规则之后。</p>
							</div>
							<Bot size={17} />
						</div>
						<label className="agent-settings-field">
							管理员补充指令
							<textarea
								value={settings.instructions}
								onChange={(event): void =>
									setSettings({ ...settings, instructions: event.target.value })
								}
								placeholder="例如：优先检查最近 30 分钟的错误率和延迟，并在结论中列出证据。"
							/>
						</label>
						<div className="agent-settings-actions">
							<button
								type="button"
								className="primary"
								disabled={saving}
								onClick={save}
							>
								<CheckCircle2 size={15} />
								保存 Agent 设置
							</button>
						</div>
					</section>
				</div>
			)}

			{activeTab === 'memory' && (
				<div className="agent-settings-content">
					<section className="agent-settings-section">
						<div className="agent-section-title">
							<div>
								<h3>对话记忆</h3>
								<p>记忆保存在本项目 LibSQL 数据卷中，按用户和任务线程隔离。</p>
							</div>
							<MemoryStick size={17} />
						</div>
						<label className="agent-settings-field compact">
							保留最近消息数
							<input
								type="number"
								min="1"
								max="200"
								value={settings.memoryLastMessages}
								onChange={(event): void =>
									setSettings({
										...settings,
										memoryLastMessages: Number(event.target.value),
									})
								}
							/>
							<span className="agent-field-hint">
								更大的窗口会增加上下文消耗；历史消息和执行事件仍会持久化。
							</span>
						</label>
						<div className="agent-settings-actions">
							<button
								type="button"
								className="primary"
								disabled={saving}
								onClick={save}
							>
								<CheckCircle2 size={15} />
								保存记忆设置
							</button>
						</div>
					</section>
				</div>
			)}

			{activeTab === 'security' && (
				<div className="agent-settings-content">
					<MCPPluginSettings token={user?.accessJwt || ''} />
					<SSHSecuritySettings token={user?.accessJwt || ''} />
					<SecurityAuditTimeline token={user?.accessJwt || ''} />
				</div>
			)}
		</div>
	);
}

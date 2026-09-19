import {
	agentApi,
	SSHAuditRecord,
	SSHCommandDefinition,
	SSHHost,
	SSHHostInput,
	SSHToolPolicy,
} from 'api/agent/client';
import { useNotifications } from 'hooks/useNotifications';
import {
	CheckCircle2,
	CircleAlert,
	KeyRound,
	Loader2,
	Plus,
	Radar,
	Server,
	ShieldCheck,
	Trash2,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const READONLY_COMMANDS = [
	['system_overview', '系统概览', '内核、主机与运行时间'],
	['disk_usage', '磁盘使用情况', '所有挂载点的容量与占用'],
	['memory_usage', '内存使用情况', '内存与交换区概览'],
	['failed_services', '失败的系统服务', 'systemd 失败单元'],
	['network_listeners', '网络监听端口', '当前 TCP/UDP 监听信息'],
	['recent_errors', '近期系统错误', '最近 100 条系统错误'],
	['security_preflight', '最小权限环境校验', 'scry-ops 账户、组与包装器权限'],
] as const;
const SSH_READONLY_TOOL_ID = 'ssh-readonly-inspect';

const EMPTY_HOST: SSHHostInput = {
	name: '',
	hostname: '',
	port: 22,
	username: 'scry-ops',
	authType: 'private_key',
	hostKeyFingerprint: '',
	enabled: true,
	secret: {},
};

interface Props {
	token: string;
}

function commandDraft(): SSHCommandDefinition {
	return { id: '', name: '', description: '', command: '' };
}

function HostEditor({
	host,
	onCancel,
	onSaved,
	token,
}: {
	host: SSHHost | null;
	onCancel: () => void;
	onSaved: () => Promise<void>;
	token: string;
}): JSX.Element {
	const { notifications } = useNotifications();
	const [form, setForm] = useState<SSHHostInput>(() =>
		host
			? {
					name: host.name,
					hostname: host.hostname,
					port: host.port,
					username: host.username,
					authType: host.authType,
					hostKeyFingerprint: host.hostKeyFingerprint,
					enabled: host.enabled,
					secret: {},
			  }
			: EMPTY_HOST,
	);
	const [busy, setBusy] = useState<'probe' | 'save' | ''>('');

	const updateSecret = (key: 'privateKey' | 'passphrase', value: string): void =>
		setForm((current) => ({
			...current,
			secret: { ...current.secret, [key]: value },
		}));

	const probe = async (): Promise<void> => {
		setBusy('probe');
		try {
			const result = await agentApi.probeSSHHost(token, form.hostname, form.port);
			setForm((current) => ({
				...current,
				hostKeyFingerprint: result.fingerprint,
			}));
			notifications.success({ message: '已获取主机指纹，请在可信渠道核对后保存' });
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : '获取指纹失败',
			});
		} finally {
			setBusy('');
		}
	};

	const save = async (): Promise<void> => {
		setBusy('save');
		try {
			if (host) await agentApi.updateSSHHost(token, host.id, form);
			else await agentApi.createSSHHost(token, form);
			notifications.success({
				message: host ? 'SSH 主机已更新' : 'SSH 主机已添加',
			});
			await onSaved();
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : '保存失败',
			});
		} finally {
			setBusy('');
		}
	};

	const secretPlaceholder = host?.hasSecret ? '已加密保存，留空则保持不变' : '';
	return (
		<div className="ssh-editor">
			<div className="ssh-editor-heading">
				<div>
					<h4>{host ? '编辑 SSH 主机' : '添加 SSH 主机'}</h4>
					<p>凭据只在服务端加密保存，不会回传到浏览器或写入审计。</p>
				</div>
				<button type="button" className="icon" onClick={onCancel} aria-label="关闭">
					<X size={16} />
				</button>
			</div>
			<div className="agent-settings-grid three">
				<label className="agent-settings-field">
					显示名称
					<input
						value={form.name}
						onChange={(event): void => setForm({ ...form, name: event.target.value })}
					/>
				</label>
				<label className="agent-settings-field">
					主机名 / IP
					<input
						value={form.hostname}
						onChange={(event): void =>
							setForm({ ...form, hostname: event.target.value })
						}
					/>
				</label>
				<label className="agent-settings-field">
					端口
					<input
						type="number"
						min="1"
						max="65535"
						value={form.port}
						onChange={(event): void =>
							setForm({ ...form, port: Number(event.target.value) })
						}
					/>
				</label>
				<label className="agent-settings-field">
					用户名
					<input value="scry-ops" readOnly />
				</label>
				<label className="agent-settings-field">
					认证方式
					<input value="SSH 私钥（强制）" readOnly />
				</label>
				<label className="agent-settings-field ssh-enabled-field">
					<span>Agent 可用</span>
					<input
						type="checkbox"
						checked={form.enabled}
						onChange={(event): void =>
							setForm({ ...form, enabled: event.target.checked })
						}
					/>
				</label>
				<label className="agent-settings-field full">
					私钥（OpenSSH / PEM）
					<textarea
						className="ssh-key-input"
						placeholder={secretPlaceholder}
						value={form.secret?.privateKey || ''}
						onChange={(event): void => updateSecret('privateKey', event.target.value)}
					/>
				</label>
				<label className="agent-settings-field full">
					私钥口令（可选）
					<input
						type="password"
						placeholder={secretPlaceholder}
						value={form.secret?.passphrase || ''}
						onChange={(event): void => updateSecret('passphrase', event.target.value)}
					/>
				</label>
				<label className="agent-settings-field full">
					主机指纹（SHA-256）
					<div className="ssh-fingerprint-row">
						<input
							value={form.hostKeyFingerprint}
							onChange={(event): void =>
								setForm({ ...form, hostKeyFingerprint: event.target.value })
							}
							placeholder="SHA256:..."
						/>
						<button
							type="button"
							disabled={busy !== '' || !form.hostname}
							onClick={probe}
						>
							{busy === 'probe' ? (
								<Loader2 className="agent-spin" size={14} />
							) : (
								<Radar size={14} />
							)}
							探测
						</button>
					</div>
					<span className="agent-field-hint">
						首次探测的结果仍需与服务器控制台或可信运维渠道中的指纹核对。
					</span>
				</label>
			</div>
			<div className="agent-settings-actions">
				<button
					type="button"
					className="primary"
					disabled={
						busy !== '' ||
						!form.name ||
						!form.hostname ||
						!form.username ||
						!form.hostKeyFingerprint
					}
					onClick={save}
				>
					{busy === 'save' ? (
						<Loader2 className="agent-spin" size={15} />
					) : (
						<CheckCircle2 size={15} />
					)}
					保存主机
				</button>
				<button type="button" onClick={onCancel}>
					取消
				</button>
			</div>
		</div>
	);
}

function PolicyEditor({
	policy,
	token,
	onSaved,
}: {
	policy: SSHToolPolicy;
	token: string;
	onSaved: () => Promise<void>;
}): JSX.Element {
	const { notifications } = useNotifications();
	const [draft, setDraft] = useState(policy);
	const [saving, setSaving] = useState(false);
	const isReadonly = policy.toolId === SSH_READONLY_TOOL_ID;

	useEffect(() => setDraft(policy), [policy]);
	const save = async (): Promise<void> => {
		setSaving(true);
		try {
			await agentApi.updateSSHPolicy(token, draft);
			notifications.success({
				message: `${isReadonly ? '只读巡检' : '扩展命令'}策略已保存`,
			});
			await onSaved();
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : '策略保存失败',
			});
		} finally {
			setSaving(false);
		}
	};

	const updateCommand = (index: number, next: SSHCommandDefinition): void =>
		setDraft((current) => ({
			...current,
			commands: current.commands.map((command, commandIndex) =>
				commandIndex === index ? next : command,
			),
		}));

	return (
		<div className="ssh-policy-card">
			<div className="ssh-policy-heading">
				<div>
					<h4>{isReadonly ? '内置只读巡检' : '管理员精确命令'}</h4>
					<p>
						{isReadonly
							? 'Agent 只能从以下内置命令 ID 中选择。'
							: 'Agent 看不到也不能修改命令文本，只能请求执行命令 ID。'}
					</p>
				</div>
				<span className={`risk l${policy.riskLevel}`}>L{policy.riskLevel}</span>
			</div>
			<div className="ssh-policy-controls">
				<label>
					<input
						type="checkbox"
						checked={draft.enabled}
						onChange={(event): void =>
							setDraft({ ...draft, enabled: event.target.checked })
						}
					/>
					启用工具
				</label>
				<label>
					<input
						type="checkbox"
						checked={draft.requireApproval}
						disabled={!isReadonly}
						onChange={(event): void =>
							setDraft({ ...draft, requireApproval: event.target.checked })
						}
					/>
					每次人工审批
				</label>
				<label>
					超时{' '}
					<input
						type="number"
						min="5"
						max="120"
						value={draft.maxSeconds}
						onChange={(event): void =>
							setDraft({ ...draft, maxSeconds: Number(event.target.value) })
						}
					/>{' '}
					秒
				</label>
			</div>
			{isReadonly ? (
				<div className="ssh-command-options">
					{READONLY_COMMANDS.map(([id, name, description]) => (
						<label key={id}>
							<input
								type="checkbox"
								checked={draft.commandIds.includes(id)}
								onChange={(event): void =>
									setDraft({
										...draft,
										commandIds: event.target.checked
											? [...draft.commandIds, id]
											: draft.commandIds.filter((item) => item !== id),
									})
								}
							/>
							<span>
								<strong>{name}</strong>
								<small>{description}</small>
							</span>
						</label>
					))}
				</div>
			) : (
				<div className="ssh-custom-commands">
					{draft.commands.map((command, index) => (
						// Command rows are controlled inputs; index keeps the row stable while its ID is edited.
						// eslint-disable-next-line react/no-array-index-key
						<div className="ssh-command-editor" key={index}>
							<input
								aria-label="命令 ID"
								placeholder="命令 ID，例如 restart_nginx"
								value={command.id}
								onChange={(event): void =>
									updateCommand(index, { ...command, id: event.target.value })
								}
							/>
							<input
								aria-label="显示名称"
								placeholder="显示名称"
								value={command.name}
								onChange={(event): void =>
									updateCommand(index, { ...command, name: event.target.value })
								}
							/>
							<input
								aria-label="用途说明"
								placeholder="用途说明"
								value={command.description}
								onChange={(event): void =>
									updateCommand(index, { ...command, description: event.target.value })
								}
							/>
							<textarea
								aria-label="精确命令"
								placeholder="管理员审核后的精确命令"
								value={command.command}
								onChange={(event): void =>
									updateCommand(index, { ...command, command: event.target.value })
								}
							/>
							<button
								type="button"
								className="icon danger"
								aria-label="删除命令"
								onClick={(): void =>
									setDraft({
										...draft,
										commands: draft.commands.filter(
											(_, commandIndex) => commandIndex !== index,
										),
									})
								}
							>
								<Trash2 size={15} />
							</button>
						</div>
					))}
					<button
						type="button"
						className="ssh-add-command"
						disabled={draft.commands.length >= 50}
						onClick={(): void =>
							setDraft({ ...draft, commands: [...draft.commands, commandDraft()] })
						}
					>
						<Plus size={14} />
						添加精确命令
					</button>
				</div>
			)}
			<div className="agent-settings-actions">
				<button type="button" className="primary" disabled={saving} onClick={save}>
					{saving ? (
						<Loader2 className="agent-spin" size={15} />
					) : (
						<CheckCircle2 size={15} />
					)}
					保存策略
				</button>
			</div>
		</div>
	);
}

export default function SSHSecuritySettings({ token }: Props): JSX.Element {
	const { notifications } = useNotifications();
	const [hosts, setHosts] = useState<SSHHost[]>([]);
	const [policies, setPolicies] = useState<SSHToolPolicy[]>([]);
	const [audits, setAudits] = useState<SSHAuditRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [editing, setEditing] = useState<SSHHost | 'new' | null>(null);
	const [testingId, setTestingId] = useState('');

	const load = useCallback(async (): Promise<void> => {
		const [nextHosts, nextPolicies, nextAudits] = await Promise.all([
			agentApi.listSSHHosts(token),
			agentApi.listSSHPolicies(token),
			agentApi.listSSHAudits(token),
		]);
		setHosts(nextHosts);
		setPolicies(nextPolicies);
		setAudits(nextAudits);
	}, [token]);

	useEffect(() => {
		setLoading(true);
		load()
			.catch((error) => notifications.error({ message: error.message }))
			.finally(() => setLoading(false));
	}, [load, notifications]);

	const readonlyPolicy = useMemo(
		() => policies.find((policy) => policy.toolId === SSH_READONLY_TOOL_ID),
		[policies],
	);
	const commandPolicy = useMemo(
		() => policies.find((policy) => policy.toolId === 'ssh-execute-command'),
		[policies],
	);

	const testHost = async (host: SSHHost): Promise<void> => {
		setTestingId(host.id);
		try {
			const result = await agentApi.testSSHHost(token, host.id);
			if (!result.ok) throw new Error('远程校验命令未返回预期结果');
			notifications.success({
				message: `${host.name} 连接成功（${result.latencyMs} ms）`,
			});
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : '连接测试失败',
			});
		} finally {
			setTestingId('');
		}
	};

	const removeHost = async (host: SSHHost): Promise<void> => {
		// This destructive action is intentionally protected by a browser-native confirmation.
		// eslint-disable-next-line no-alert
		if (!window.confirm(`删除 SSH 主机“${host.name}”？审计记录会保留。`)) return;
		try {
			await agentApi.deleteSSHHost(token, host.id);
			await load();
			notifications.success({ message: 'SSH 主机已删除' });
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : '删除失败',
			});
		}
	};

	if (loading)
		return (
			<div className="ssh-loading">
				<Loader2 className="agent-spin" size={18} />
				加载 SSH 安全配置
			</div>
		);
	return (
		<>
			<section className="agent-settings-section">
				<div className="agent-section-title">
					<div>
						<h3>SSH 主机</h3>
						<p>配置 Agent 可以连接的服务器、加密凭据和固定主机指纹。</p>
					</div>
					<button
						type="button"
						className="ssh-heading-action"
						onClick={(): void => setEditing('new')}
					>
						<Plus size={14} />
						添加主机
					</button>
				</div>
				{editing && (
					<HostEditor
						token={token}
						host={editing === 'new' ? null : editing}
						onCancel={(): void => setEditing(null)}
						onSaved={async (): Promise<void> => {
							setEditing(null);
							await load();
						}}
					/>
				)}
				<div className="ssh-host-list">
					{hosts.length === 0 && !editing && (
						<div className="ssh-empty">
							<Server size={20} />
							<span>尚未配置 SSH 主机。工具保持不可用。</span>
						</div>
					)}
					{hosts.map((host) => (
						<div
							className={`ssh-host-card${host.simulated ? ' simulated' : ''}`}
							key={host.id}
						>
							<div className="ssh-host-icon">
								<Server size={18} />
							</div>
							<div className="ssh-host-summary">
								<strong>
									{host.name}
									{host.simulated && (
										<span className="ssh-simulation-badge">调试模拟</span>
									)}
								</strong>
								<span>
									{host.username}@{host.hostname}:{host.port}
								</span>
								<code>{host.hostKeyFingerprint}</code>
							</div>
							<div className="ssh-host-state">
								<span className={host.enabled ? 'enabled' : ''}>
									{host.enabled ? '已启用' : '已停用'}
								</span>
								<small>
									<KeyRound size={12} />
									{host.simulated ? '模拟凭据' : '凭据已加密'}
								</small>
							</div>
							<div className="ssh-host-actions">
								<button
									type="button"
									disabled={testingId === host.id}
									onClick={(): Promise<void> => testHost(host)}
								>
									{testingId === host.id ? (
										<Loader2 className="agent-spin" size={14} />
									) : (
										<Radar size={14} />
									)}
									测试
								</button>
								{!host.simulated && (
									<>
										<button type="button" onClick={(): void => setEditing(host)}>
											编辑
										</button>
										<button
											type="button"
											className="icon danger"
											aria-label="删除主机"
											onClick={(): Promise<void> => removeHost(host)}
										>
											<Trash2 size={14} />
										</button>
									</>
								)}
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="agent-settings-section">
				<div className="agent-section-title">
					<div>
						<h3>SSH 工具策略</h3>
						<p>模型只选择主机 ID 和命令 ID；不会接收凭据或自由输入 shell。</p>
					</div>
					<ShieldCheck size={17} />
				</div>
				<div className="agent-security-note">
					<CircleAlert size={17} />
					<span>
						扩展命令属于 L3 操作，无论页面设置如何都会由服务端强制要求人工审批。SSH
						不启用 PTY、交互 shell、端口转发或 Docker Socket。
					</span>
				</div>
				{readonlyPolicy && (
					<PolicyEditor policy={readonlyPolicy} token={token} onSaved={load} />
				)}
				{commandPolicy && (
					<PolicyEditor policy={commandPolicy} token={token} onSaved={load} />
				)}
			</section>

			<section className="agent-settings-section">
				<div className="agent-section-title">
					<div>
						<h3>最近执行审计</h3>
						<p>只保存调用元数据、字节数与错误摘要，不保存命令输出或凭据。</p>
					</div>
					<ShieldCheck size={17} />
				</div>
				<div className="ssh-audit-table">
					<div className="ssh-audit-row heading">
						<span>时间 / 主机</span>
						<span>工具 / 命令</span>
						<span>结果</span>
						<span>耗时 / 输出</span>
					</div>
					{audits.length === 0 && <div className="ssh-empty">暂无 SSH 执行记录</div>}
					{audits.map((audit) => (
						<div className="ssh-audit-row" key={audit.id}>
							<span>
								<strong>{audit.hostName}</strong>
								<small>{new Date(audit.createdAt).toLocaleString('zh-CN')}</small>
							</span>
							<span>
								<strong>
									{audit.toolId === SSH_READONLY_TOOL_ID ? '只读巡检' : '扩展命令'}
								</strong>
								<code>{audit.commandId}</code>
							</span>
							<span className={audit.status}>
								{audit.status === 'success' ? (
									<CheckCircle2 size={14} />
								) : (
									<CircleAlert size={14} />
								)}
								{audit.status === 'success' ? '成功' : '失败'}
								{audit.error && <small>{audit.error}</small>}
							</span>
							<span>
								{audit.durationMs} ms
								<small>
									{audit.stdoutBytes + audit.stderrBytes} bytes · exit{' '}
									{audit.exitCode ?? '-'}
								</small>
							</span>
						</div>
					))}
				</div>
			</section>
		</>
	);
}

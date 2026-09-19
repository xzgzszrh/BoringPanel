import { agentApi, MCPServerInput, MCPServerRecord } from 'api/agent/client';
import { useNotifications } from 'hooks/useNotifications';
import {
	CircleAlert,
	CircleCheck,
	ExternalLink,
	Loader2,
	Plus,
	RefreshCw,
	Save,
	ShieldCheck,
	Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Props = { token: string };

const empty: MCPServerInput = {
	name: '',
	description: '',
	url: '',
	enabled: true,
	headers: {},
	timeoutMs: 30000,
};

function parseHeaders(
	value: string,
	preserveExisting: boolean,
): Record<string, string> | undefined {
	if (!value.trim()) return preserveExisting ? undefined : {};
	const headers = JSON.parse(value) as Record<string, string>;
	if (!headers || Array.isArray(headers) || typeof headers !== 'object') {
		throw new Error('请求头必须是 JSON 对象');
	}
	return headers;
}

export default function MCPPluginSettings({ token }: Props): JSX.Element {
	const { notifications } = useNotifications();
	const [servers, setServers] = useState<MCPServerRecord[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [form, setForm] = useState<MCPServerInput>(empty);
	const [headersTextValue, setHeadersTextValue] = useState('{}');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [test, setTest] = useState<{
		ok: boolean;
		tools: Array<{ id: string; description: string }>;
		error: string;
	} | null>(null);

	const load = useCallback((): void => {
		if (!token) return;
		setLoading(true);
		agentApi
			.listMCPServers(token)
			.then(setServers)
			.catch((error) => notifications.error({ message: error.message }))
			.finally(() => setLoading(false));
	}, [notifications, token]);
	useEffect(load, [load]);

	const select = (server: MCPServerRecord): void => {
		setSelected(server.id);
		setForm({
			name: server.name,
			description: server.description,
			url: server.url,
			enabled: server.enabled,
			timeoutMs: server.timeoutMs,
		});
		setHeadersTextValue('');
		setTest(null);
	};

	const reset = (): void => {
		setSelected(null);
		setForm(empty);
		setHeadersTextValue('{}');
		setTest(null);
	};

	const save = async (): Promise<void> => {
		setSaving(true);
		try {
			const headers = parseHeaders(headersTextValue, Boolean(selected));
			const input = { ...form, headers };
			const saved = selected
				? await agentApi.updateMCPServer(token, selected, input)
				: await agentApi.createMCPServer(token, input);
			setServers((current) =>
				selected
					? current.map((item) => (item.id === saved.id ? saved : item))
					: [saved, ...current],
			);
			select(saved);
			notifications.success({ message: 'MCP 插件已保存' });
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : '保存失败',
			});
		} finally {
			setSaving(false);
		}
	};

	const remove = async (): Promise<void> => {
		// eslint-disable-next-line no-alert
		if (!selected || !window.confirm('删除当前 MCP 插件？')) return;
		await agentApi.deleteMCPServer(token, selected);
		setServers((current) => current.filter((item) => item.id !== selected));
		reset();
	};

	const runTest = async (): Promise<void> => {
		if (!selected) return;
		setTesting(true);
		try {
			setTest(await agentApi.testMCPServer(token, selected));
		} catch (error) {
			notifications.error({
				message: error instanceof Error ? error.message : 'MCP 测试失败',
			});
		} finally {
			setTesting(false);
		}
	};

	return (
		<section className="agent-settings-section mcp-plugin-settings">
			<div className="agent-section-title">
				<div>
					<h3>MCP 插件</h3>
					<p>
						启用后，远程 MCP 工具会按当前组织加入 Agent；凭证只在服务端加密保存。
					</p>
				</div>
				<ExternalLink size={17} />
			</div>
			<div className="mcp-plugin-layout">
				<div className="mcp-plugin-list">
					<div className="mcp-plugin-list-heading">
						<span>已注册服务</span>
						<button type="button" className="icon" title="刷新" onClick={load}>
							<RefreshCw size={14} />
						</button>
					</div>
					{loading ? (
						<Loader2 className="agent-spin" size={17} />
					) : (
						servers.map((server) => (
							<button
								type="button"
								key={server.id}
								className={`mcp-plugin-item ${selected === server.id ? 'active' : ''}`}
								onClick={(): void => select(server)}
							>
								<span>
									<strong>{server.name}</strong>
									<small>{server.url}</small>
								</span>
								<span className={`mcp-dot ${server.enabled ? 'on' : ''}`} />
							</button>
						))
					)}
					{!loading && !servers.length && (
						<span className="agent-field-hint">尚未注册远程 MCP 服务。</span>
					)}
					<button type="button" className="mcp-add-button" onClick={reset}>
						<Plus size={14} />
						新增插件
					</button>
				</div>
				<div className="mcp-plugin-editor">
					<div className="agent-settings-grid">
						<label className="agent-settings-field">
							<span>名称</span>
							<input
								value={form.name}
								onChange={(event): void =>
									setForm({ ...form, name: event.target.value })
								}
								placeholder="例如：资产查询"
							/>
						</label>
						<label className="agent-settings-field">
							<span>超时（毫秒）</span>
							<input
								type="number"
								min="1000"
								max="120000"
								value={form.timeoutMs}
								onChange={(event): void =>
									setForm({ ...form, timeoutMs: Number(event.target.value) })
								}
							/>
						</label>
						<label className="agent-settings-field full">
							<span>Streamable HTTP 地址</span>
							<input
								value={form.url}
								onChange={(event): void =>
									setForm({ ...form, url: event.target.value })
								}
								placeholder="https://plugin.example.com/mcp"
							/>
						</label>
						<label className="agent-settings-field full">
							<span>说明</span>
							<input
								value={form.description}
								onChange={(event): void =>
									setForm({ ...form, description: event.target.value })
								}
							/>
						</label>
						<label className="agent-settings-field full">
							<span>请求头 JSON（留空保留已保存凭证）</span>
							<textarea
								className="mcp-headers"
								value={headersTextValue}
								onChange={(event): void => setHeadersTextValue(event.target.value)}
								placeholder='{&#10;  "Authorization": "Bearer ..."&#10;}'
							/>
						</label>
					</div>
					<label className="mcp-enabled-toggle">
						<input
							type="checkbox"
							checked={form.enabled}
							onChange={(event): void =>
								setForm({ ...form, enabled: event.target.checked })
							}
						/>
						<ShieldCheck size={15} />
						启用此插件
					</label>
					<div className="agent-settings-actions">
						<button
							type="button"
							className="primary"
							disabled={saving || !form.name.trim() || !form.url.trim()}
							onClick={save}
						>
							<Save size={15} />
							{saving ? '保存中' : '保存插件'}
						</button>
						{selected && (
							<>
								<button type="button" disabled={testing} onClick={runTest}>
									{testing ? (
										<Loader2 className="agent-spin" size={15} />
									) : (
										<CircleCheck size={15} />
									)}
									测试工具
								</button>
								<button type="button" className="danger" onClick={remove}>
									<Trash2 size={15} />
									删除
								</button>
							</>
						)}
					</div>
					{test && (
						<div className={`mcp-test-result ${test.ok ? 'success' : 'failed'}`}>
							{test.ok ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
							<span>
								{test.ok ? `连接成功，发现 ${test.tools.length} 个工具` : test.error}
							</span>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}

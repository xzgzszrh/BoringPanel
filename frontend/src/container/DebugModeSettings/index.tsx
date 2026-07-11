import './DebugModeSettings.styles.scss';

import {
	Alert,
	Button,
	InputNumber,
	Modal,
	Select,
	Space,
	Spin,
	Switch,
	Tag,
	Typography,
} from 'antd';
import cleanupDebugData from 'api/debugMode/cleanup';
import generateDebugData from 'api/debugMode/generate';
import getDebugMode from 'api/debugMode/get';
import updateDebugMode from 'api/debugMode/update';
import { Play, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import {
	DebugModeConfig,
	DebugModeStatus,
	DebugSignals,
} from 'types/api/debugMode';

const defaultConfig: DebugModeConfig = {
	enabled: false,
	profile: 'standard',
	scenario: 'normal',
	intervalSeconds: 10,
	backfillMinutes: 30,
	signals: {
		traces: true,
		logs: true,
		metrics: true,
		infrastructure: true,
		messaging: true,
	},
};

const debugModeQueryKey = 'debug-mode';

const signalOptions: Array<{
	key: keyof DebugSignals;
	label: string;
	description: string;
}> = [
	{
		key: 'traces',
		label: '服务与链路',
		description: '生成关联服务、拓扑和调用链',
	},
	{ key: 'logs', label: '日志', description: '生成与链路关联的结构化日志' },
	{ key: 'metrics', label: '业务指标', description: '生成请求量和订单指标' },
	{
		key: 'infrastructure',
		label: '基础设施',
		description: '生成主机 CPU、内存和负载指标',
	},
	{
		key: 'messaging',
		label: '消息队列',
		description: '生成 Kafka 链路和积压指标',
	},
];

function DebugModeSettings(): JSX.Element {
	const queryClient = useQueryClient();
	const [config, setConfig] = useState<DebugModeConfig>(defaultConfig);
	const [isDirty, setIsDirty] = useState(false);
	const { data, isLoading, error } = useQuery<DebugModeStatus>(
		[debugModeQueryKey],
		getDebugMode,
		{ refetchInterval: 5000 },
	);

	useEffect(() => {
		if (data?.config && !isDirty) {
			setConfig(data.config);
		}
	}, [data?.config, isDirty]);

	const saveMutation = useMutation(updateDebugMode, {
		onSuccess: (status) => {
			queryClient.setQueryData([debugModeQueryKey], status);
			setIsDirty(false);
		},
	});
	const generateMutation = useMutation(generateDebugData, {
		onSuccess: (status) => {
			queryClient.setQueryData([debugModeQueryKey], status);
		},
	});
	const cleanupMutation = useMutation(cleanupDebugData, {
		onSuccess: (status) => {
			queryClient.setQueryData([debugModeQueryKey], status);
			setConfig(status.config);
			setIsDirty(false);
		},
	});

	const updateSignal = (key: keyof DebugSignals, enabled: boolean): void => {
		setIsDirty(true);
		setConfig((current) => ({
			...current,
			signals: { ...current.signals, [key]: enabled },
		}));
	};

	const updateConfig = (next: Partial<DebugModeConfig>): void => {
		setIsDirty(true);
		setConfig((current) => ({ ...current, ...next }));
	};

	if (isLoading) {
		return <Spin />;
	}

	if (error) {
		return <Alert type="error" showIcon message="无法读取调试模式配置" />;
	}

	return (
		<div className="debug-mode-settings">
			<Typography.Paragraph className="debug-mode-intro">
				通过现有 OTLP 数据链路生成可重复的服务、链路、日志、指标和消息队列数据。
				所有模拟资源都会标记为 scry.debug=true。
			</Typography.Paragraph>

			{!data?.available && (
				<Alert
					showIcon
					type="warning"
					message="当前环境未启用调试模式"
					description="需要在 query-service 中设置 SCRY_DEBUG_MODE_AVAILABLE=true。"
				/>
			)}
			{(saveMutation.isError ||
				generateMutation.isError ||
				cleanupMutation.isError) && (
				<Alert
					showIcon
					type="error"
					message="操作失败，请检查 query-service 日志"
				/>
			)}

			<section className="debug-mode-section">
				<div className="debug-mode-section-header">
					<h3 className="debug-mode-section-title">运行状态</h3>
					<Tag color={data?.running ? 'green' : 'default'}>
						{data?.running ? '正在生成' : '已停止'}
					</Tag>
				</div>
				<div className="debug-mode-status-row">
					<span className="debug-mode-status-meta">
						已生成 {data?.generatedBatches || 0} 个批次
						{data?.lastGeneratedAt
							? `，最近生成于 ${new Date(data.lastGeneratedAt).toLocaleString(
									'zh-CN',
							  )}`
							: ''}
					</span>
					<Switch
						checked={config.enabled}
						disabled={!data?.available}
						onChange={(enabled): void => updateConfig({ enabled })}
						checkedChildren="开启"
						unCheckedChildren="关闭"
					/>
				</div>
				{data?.lastError && (
					<Alert
						type="error"
						showIcon
						message="最近生成失败"
						description={data.lastError}
					/>
				)}
				{data?.cleaning && (
					<Alert
						type="info"
						showIcon
						message="正在清理模拟数据"
						description="正在等待 Collector 刷新并执行 ClickHouse 清理，请勿重复操作。"
					/>
				)}
				{data?.cleanupError && (
					<Alert
						type="error"
						showIcon
						message="模拟数据清理失败"
						description={data.cleanupError}
					/>
				)}
				{data?.lastCleanupAt && !data.cleanupError && !data.cleaning && (
					<span className="debug-mode-status-meta">
						最近清理于 {new Date(data.lastCleanupAt).toLocaleString('zh-CN')}
					</span>
				)}
			</section>

			<section className="debug-mode-section">
				<h3 className="debug-mode-section-title">生成策略</h3>
				<div className="debug-mode-setting-row">
					<div className="debug-mode-setting-copy">
						<span className="debug-mode-setting-label">数据规模</span>
						<span className="debug-mode-setting-description">
							控制每个周期生成的请求数量
						</span>
					</div>
					<Select
						className="debug-mode-select"
						value={config.profile}
						onChange={(profile): void => updateConfig({ profile })}
						options={[
							{ value: 'light', label: '轻量' },
							{ value: 'standard', label: '标准' },
							{ value: 'high', label: '高负载' },
						]}
					/>
				</div>
				<div className="debug-mode-setting-row">
					<div className="debug-mode-setting-copy">
						<span className="debug-mode-setting-label">运行场景</span>
						<span className="debug-mode-setting-description">
							模拟正常、慢调用或错误突增
						</span>
					</div>
					<Select
						className="debug-mode-select"
						value={config.scenario}
						onChange={(scenario): void => updateConfig({ scenario })}
						options={[
							{ value: 'normal', label: '正常运行' },
							{ value: 'slow', label: '延迟升高' },
							{ value: 'errors', label: '错误突增' },
						]}
					/>
				</div>
				<div className="debug-mode-setting-row">
					<div className="debug-mode-setting-copy">
						<span className="debug-mode-setting-label">生成间隔</span>
						<span className="debug-mode-setting-description">
							允许范围为 5 至 60 秒
						</span>
					</div>
					<InputNumber
						className="debug-mode-number"
						min={5}
						max={60}
						addonAfter="秒"
						value={config.intervalSeconds}
						onChange={(value): void => updateConfig({ intervalSeconds: value || 10 })}
					/>
				</div>
				<div className="debug-mode-setting-row">
					<div className="debug-mode-setting-copy">
						<span className="debug-mode-setting-label">历史回填</span>
						<span className="debug-mode-setting-description">
							开启后立即生成最近一段时间的数据
						</span>
					</div>
					<Select
						className="debug-mode-select"
						value={config.backfillMinutes}
						onChange={(backfillMinutes): void => updateConfig({ backfillMinutes })}
						options={[
							{ value: 0, label: '不回填' },
							{ value: 30, label: '最近 30 分钟' },
							{ value: 360, label: '最近 6 小时' },
							{ value: 1440, label: '最近 24 小时' },
						]}
					/>
				</div>
			</section>

			<section className="debug-mode-section">
				<h3 className="debug-mode-section-title">数据类型</h3>
				<div className="debug-mode-signals">
					{signalOptions.map((option) => (
						<div className="debug-mode-setting-row" key={option.key}>
							<div className="debug-mode-setting-copy">
								<span className="debug-mode-setting-label">{option.label}</span>
								<span className="debug-mode-setting-description">
									{option.description}
								</span>
							</div>
							<Switch
								checked={config.signals[option.key]}
								onChange={(enabled): void => updateSignal(option.key, enabled)}
							/>
						</div>
					))}
				</div>
			</section>

			<div className="debug-mode-actions">
				<Button
					danger
					icon={<Trash2 size={16} />}
					disabled={!data?.available || data?.cleaning}
					loading={cleanupMutation.isLoading || data?.cleaning}
					onClick={(): void => {
						Modal.confirm({
							title: '清理所有模拟数据？',
							content:
								'该操作会停止调试模式，并删除模拟链路、日志、指标、服务拓扑、异常和调试告警规则。真实数据不会被删除。',
							okText: '确认清理',
							cancelText: '取消',
							okButtonProps: { danger: true },
							onOk: (): void => cleanupMutation.mutate(),
						});
					}}
				>
					一键清理模拟数据
				</Button>
				<Space>
					<Button
						icon={<Play size={16} />}
						disabled={!data?.available}
						loading={generateMutation.isLoading}
						onClick={(): void => generateMutation.mutate()}
					>
						立即生成
					</Button>
					<Button
						type="primary"
						icon={<Save size={16} />}
						disabled={!data?.available}
						loading={saveMutation.isLoading}
						onClick={(): void => saveMutation.mutate(config)}
					>
						保存设置
					</Button>
				</Space>
			</div>
		</div>
	);
}

export default DebugModeSettings;

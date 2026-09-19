import { SelectedModuleStepProps } from '../OnboardingContainer';
import ConnectionStatus from '../Steps/ConnectionStatus/ConnectionStatus';
import DataSource from '../Steps/DataSource/DataSource';
import EnvironmentDetails from '../Steps/EnvironmentDetails/EnvironmentDetails';
import LogsConnectionStatus from '../Steps/LogsConnectionStatus/LogsConnectionStatus';
import MarkdownStep from '../Steps/MarkdownStep/MarkdownStep';
import SelectMethod from '../Steps/SelectMethod/SelectMethod';

export const stepsMap = {
	dataSource: 'dataSource',
	environmentDetails: 'environmentDetails',
	selectMethod: 'selectMethod',
	setupOtelCollector: 'setupOtelCollector',
	instrumentApplication: 'instrumentApplication',
	cloneRepository: 'cloneRepository',
	startContainer: 'startContainer',
	runApplication: 'runApplication',
	testConnection: 'testConnection',
	configureReceiver: 'configureReceiver',
	checkServiceStatus: 'checkServiceStatus',
	restartOtelCollector: 'restartOtelCollector',
	plotMetrics: 'plotMetrics',
	configureHostmetricsJson: 'configureHostmetricsJson',
	configureMetricsReceiver: 'configureMetricsReceiver',
	addHttpDrain: 'addHttpDrain',
	setupLogDrains: `setupLogDrains`,
	createHttpPayload: `createHttpPayload`,
	configureAws: `configureAws`,
	sendLogsCloudwatch: `sendLogsCloudwatch`,
	setupDaemonService: `setupDaemonService`,
	createOtelConfig: `createOtelConfig`,
	createDaemonService: `createDaemonService`,
	ecsSendData: `ecsSendData`,
	createSidecarCollectorContainer: `createSidecarCollectorContainer`,
	deployTaskDefinition: `deployTaskDefinition`,
	ecsSendLogsData: `ecsSendLogsData`,
	monitorDashboard: `monitorDashboard`,
	setupCentralCollector: `setupCentralCollector`,
	setupAzureEventsHub: `setupAzureEventsHub`,
	sendTraces: `sendTraces`,
	sendLogs: `sendLogs`,
	sendMetrics: `sendMetrics`,
	sendHostmetricsLogs: `sendHostmetricsLogs`,
};

export const DataSourceStep: SelectedModuleStepProps = {
	id: stepsMap.dataSource,
	title: '数据来源',
	component: <DataSource />,
};

export const EnvDetailsStep: SelectedModuleStepProps = {
	id: stepsMap.environmentDetails,
	title: '环境详情',
	component: <EnvironmentDetails />,
};

export const SelectMethodStep: SelectedModuleStepProps = {
	id: stepsMap.selectMethod,
	title: '选择方法',
	component: <SelectMethod />,
};

export const SetupOtelCollectorStep: SelectedModuleStepProps = {
	id: stepsMap.setupOtelCollector,
	title: '设置 Otel Collector',
	component: <MarkdownStep />,
};

export const InstallOpenTelemetryStep: SelectedModuleStepProps = {
	id: stepsMap.instrumentApplication,
	title: '仪器应用',
	component: <MarkdownStep />,
};

export const CloneRepo: SelectedModuleStepProps = {
	id: stepsMap.cloneRepository,
	title: '克隆存储库',
	component: <MarkdownStep />,
};

export const StartContainer: SelectedModuleStepProps = {
	id: stepsMap.startContainer,
	title: '启动容器',
	component: <MarkdownStep />,
};

export const RunApplicationStep: SelectedModuleStepProps = {
	id: stepsMap.runApplication,
	title: '运行应用程序',
	component: <MarkdownStep />,
};

export const TestConnectionStep: SelectedModuleStepProps = {
	id: stepsMap.testConnection,
	title: '测试连接',
	component: <ConnectionStatus />,
};

export const LogsTestConnectionStep: SelectedModuleStepProps = {
	id: stepsMap.testConnection,
	title: '测试连接',
	component: <LogsConnectionStatus />,
};

export const ConfigureReceiver: SelectedModuleStepProps = {
	id: stepsMap.configureReceiver,
	title: '配置接收器',
	component: <MarkdownStep />,
};

export const CheckServiceStatus: SelectedModuleStepProps = {
	id: stepsMap.checkServiceStatus,
	title: '检查服务状态',
	component: <MarkdownStep />,
};

export const RestartOtelCollector: SelectedModuleStepProps = {
	id: stepsMap.restartOtelCollector,
	title: '重新启动 Otel Collector',
	component: <MarkdownStep />,
};

export const PlotMetrics: SelectedModuleStepProps = {
	id: stepsMap.plotMetrics,
	title: '绘制指标',
	component: <MarkdownStep />,
};

export const ConfigureHostmetricsJSON: SelectedModuleStepProps = {
	id: stepsMap.configureHostmetricsJson,
	title: '配置主机指标 JSON',
	component: <MarkdownStep />,
};

export const ConfigureMetricsReceiver: SelectedModuleStepProps = {
	id: stepsMap.configureMetricsReceiver,
	title: '配置指标接收器',
	component: <MarkdownStep />,
};

export const AddHttpDrain: SelectedModuleStepProps = {
	id: stepsMap.addHttpDrain,
	title: '添加 HTTP 排水',
	component: <MarkdownStep />,
};

export const SetupLogDrains: SelectedModuleStepProps = {
	id: stepsMap.setupLogDrains,
	title: '设置日志排水管',
	component: <MarkdownStep />,
};

export const CreateHttpPayload: SelectedModuleStepProps = {
	id: stepsMap.createHttpPayload,
	title: '创建 Json 负载',
	component: <MarkdownStep />,
};

export const ConfigureAws: SelectedModuleStepProps = {
	id: stepsMap.configureAws,
	title: '配置AWS',
	component: <MarkdownStep />,
};
export const SendLogsCloudwatch: SelectedModuleStepProps = {
	id: stepsMap.sendLogsCloudwatch,
	title: '发送日志',
	component: <MarkdownStep />,
};
export const SetupDaemonService: SelectedModuleStepProps = {
	id: stepsMap.setupDaemonService,
	title: '设置守护进程服务',
	component: <MarkdownStep />,
};
export const CreateOtelConfig: SelectedModuleStepProps = {
	id: stepsMap.createOtelConfig,
	title: '创建 OTel 配置',
	component: <MarkdownStep />,
};
export const CreateDaemonService: SelectedModuleStepProps = {
	id: stepsMap.createDaemonService,
	title: '创建守护进程服务',
	component: <MarkdownStep />,
};
export const EcsSendData: SelectedModuleStepProps = {
	id: stepsMap.ecsSendData,
	title: '发送迹线数据',
	component: <MarkdownStep />,
};
export const CreateSidecarCollectorContainer: SelectedModuleStepProps = {
	id: stepsMap.createSidecarCollectorContainer,
	title: '创建 Sidecar 收集器',
	component: <MarkdownStep />,
};
export const DeployTaskDefinition: SelectedModuleStepProps = {
	id: stepsMap.deployTaskDefinition,
	title: '部署任务定义',
	component: <MarkdownStep />,
};
export const EcsSendLogsData: SelectedModuleStepProps = {
	id: stepsMap.ecsSendLogsData,
	title: '发送日志数据',
	component: <MarkdownStep />,
};
export const MonitorDashboard: SelectedModuleStepProps = {
	id: stepsMap.monitorDashboard,
	title: '使用仪表盘进行监控',
	component: <MarkdownStep />,
};
export const SetupCentralCollectorStep: SelectedModuleStepProps = {
	id: stepsMap.setupCentralCollector,
	title: '设置中央收集器',
	component: <MarkdownStep />,
};
export const SetupAzureEventsHub: SelectedModuleStepProps = {
	id: stepsMap.setupAzureEventsHub,
	title: '设置事件中心',
	component: <MarkdownStep />,
};
export const SendTraces: SelectedModuleStepProps = {
	id: stepsMap.sendTraces,
	title: '发送链路',
	component: <MarkdownStep />,
};
export const SendLogs: SelectedModuleStepProps = {
	id: stepsMap.sendLogs,
	title: '发送日志',
	component: <MarkdownStep />,
};
export const SendMetrics: SelectedModuleStepProps = {
	id: stepsMap.sendMetrics,
	title: '发送指标',
	component: <MarkdownStep />,
};
export const SendHostmetricsLogs: SelectedModuleStepProps = {
	id: stepsMap.sendHostmetricsLogs,
	title: '主机指标和日志记录',
	component: <MarkdownStep />,
};

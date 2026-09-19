import { DataSource } from 'types/common/queryBuilder';

export const ALERT_INFO_LINKS = [
	{
		infoText: 'How to create Metrics-based alerts',
		link: '',
		leftIconVisible: false,
		rightIconVisible: true,
		dataSource: DataSource.METRICS,
	},
	{
		infoText: 'How to create Log-based alerts',
		link: '',
		leftIconVisible: false,
		rightIconVisible: true,
		dataSource: DataSource.LOGS,
	},
	{
		infoText: 'How to create Trace-based alerts',
		link: '',
		leftIconVisible: false,
		rightIconVisible: true,
		dataSource: DataSource.TRACES,
	},
];

export const ALERT_CARDS = [
	{
		header: '高内存使用率告警',
		subheader: "Monitor your host's memory usage",
		dataSource: DataSource.METRICS,
		link: '',
	},
	{
		header: '外部 API 呼叫缓慢时发出告警',
		subheader: 'Monitor your external API calls',
		dataSource: DataSource.TRACES,
		link: '',
	},
	{
		header: '针对日志中高比例的超时错误发出告警',
		subheader: 'Monitor your logs for errors',
		dataSource: DataSource.LOGS,
		link: '',
	},
	{
		header: '端点错误百分比较高时发出告警',
		subheader: 'Monitor your API endpoint',
		dataSource: DataSource.METRICS,
		link: '',
	},
];

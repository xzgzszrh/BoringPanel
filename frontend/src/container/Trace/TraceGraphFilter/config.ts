import { DefaultOptionType } from 'antd/es/select';

interface Dropdown {
	key: string;
	displayValue: string;
	yAxisUnit?: string;
}

export const groupBy: DefaultOptionType[] = [
	{
		label: '没有任何',
		value: 'none',
	},
	{
		label: '服务名称',
		value: 'serviceName',
	},
	{
		label: '手术',
		value: 'name',
	},
	{
		label: 'HTTP URL',
		value: 'httpUrl',
	},
	{
		label: 'HTTP方法',
		value: 'httpMethod',
	},
	{
		label: 'HTTP 主机',
		value: 'httpHost',
	},
	{
		label: 'HTTP 路由',
		value: 'httpRoute',
	},
	{
		label: '远程过程调用方法',
		value: 'rpcMethod',
	},
	{
		label: '状态码',
		value: 'responseStatusCode',
	},
	{
		label: '数据库名称',
		value: 'dbName',
	},
	{
		label: '数据库系统',
		value: 'dbSystem',
	},
	{
		label: '数据库操作',
		value: 'dbOperation',
	},
	{
		label: '消息系统',
		value: 'msgSystem',
	},
	{
		label: '消息操作',
		value: 'msgOperation',
	},
];

export const functions: Dropdown[] = [
	{ displayValue: 'Count', key: 'count', yAxisUnit: 'short' },
	{
		displayValue: 'Rate per sec',
		key: 'ratePerSec',
		yAxisUnit: 'reqps',
	},
	{ displayValue: 'Sum (duration)', key: 'sum', yAxisUnit: 'ns' },
	{ displayValue: 'Avg (duration)', key: 'avg', yAxisUnit: 'ns' },
	{
		displayValue: 'Max (duration)',
		key: 'max',
		yAxisUnit: 'ns',
	},
	{
		displayValue: 'Min (duration)',
		key: 'min',
		yAxisUnit: 'ns',
	},
	{
		displayValue: '50th percentile (duration)',
		key: 'p50',
		yAxisUnit: 'ns',
	},
	{
		displayValue: '90th percentile (duration)',
		key: 'p90',
		yAxisUnit: 'ns',
	},
	{
		displayValue: '95th percentile (duration)',
		key: 'p95',
		yAxisUnit: 'ns',
	},
	{
		displayValue: '99th percentile (duration)',
		key: 'p99',
		yAxisUnit: 'ns',
	},
];

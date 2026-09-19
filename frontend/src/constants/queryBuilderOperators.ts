import {
	LogsAggregatorOperator,
	MetricAggregateOperator,
	TracesAggregatorOperator,
} from 'types/common/queryBuilder';
import { SelectOption } from 'types/common/select';

export const metricAggregateOperatorOptions: SelectOption<string, string>[] = [
	{
		value: MetricAggregateOperator.NOOP,
		label: 'NOOP',
	},
	{
		value: MetricAggregateOperator.COUNT,
		label: '数数',
	},
	{
		value: MetricAggregateOperator.COUNT_DISTINCT,
		// eslint-disable-next-line sonarjs/no-duplicate-string
		label: '计数不同',
	},
	{
		value: MetricAggregateOperator.SUM,
		label: '和',
	},
	{
		value: MetricAggregateOperator.AVG,
		label: '平均',
	},
	{
		value: MetricAggregateOperator.MAX,
		label: '最大限度',
	},
	{
		value: MetricAggregateOperator.MIN,
		label: '最小',
	},
	{
		value: MetricAggregateOperator.P05,
		label: 'P05',
	},
	{
		value: MetricAggregateOperator.P10,
		label: 'P10',
	},
	{
		value: MetricAggregateOperator.P20,
		label: 'P20',
	},
	{
		value: MetricAggregateOperator.P25,
		label: 'P25',
	},
	{
		value: MetricAggregateOperator.P50,
		label: 'P50',
	},
	{
		value: MetricAggregateOperator.P75,
		label: 'P75',
	},
	{
		value: MetricAggregateOperator.P90,
		label: 'P90',
	},
	{
		value: MetricAggregateOperator.P95,
		label: 'P95',
	},
	{
		value: MetricAggregateOperator.P99,
		label: 'P99',
	},
	{
		value: MetricAggregateOperator.RATE,
		label: '速度',
	},
	{
		value: MetricAggregateOperator.SUM_RATE,
		label: '总率',
	},
	{
		value: MetricAggregateOperator.AVG_RATE,
		label: '平均率',
	},
	{
		value: MetricAggregateOperator.MAX_RATE,
		label: '最大速率',
	},
	{
		value: MetricAggregateOperator.MIN_RATE,
		label: '最低速率',
	},
	{
		value: MetricAggregateOperator.RATE_SUM,
		label: '费率总和',
	},
	{
		value: MetricAggregateOperator.RATE_AVG,
		label: '平均价格',
	},
	{
		value: MetricAggregateOperator.RATE_MIN,
		label: '最低速率',
	},
	{
		value: MetricAggregateOperator.RATE_MAX,
		label: '最大速率',
	},
	{
		value: MetricAggregateOperator.HIST_QUANTILE_50,
		label: 'Hist_quantile_50',
	},
	{
		value: MetricAggregateOperator.HIST_QUANTILE_75,
		label: 'Hist_quantile_75',
	},
	{
		value: MetricAggregateOperator.HIST_QUANTILE_90,
		label: 'Hist_quantile_90',
	},
	{
		value: MetricAggregateOperator.HIST_QUANTILE_95,
		label: 'Hist_quantile_95',
	},
	{
		value: MetricAggregateOperator.HIST_QUANTILE_99,
		label: 'Hist_quantile_99',
	},
];

export const tracesAggregateOperatorOptions: SelectOption<string, string>[] = [
	{
		value: TracesAggregatorOperator.NOOP,
		label: 'NOOP',
	},
	{
		value: TracesAggregatorOperator.COUNT,
		label: '数数',
	},
	{
		value: TracesAggregatorOperator.COUNT_DISTINCT,
		label: '计数不同',
	},
	{
		value: TracesAggregatorOperator.SUM,
		label: '和',
	},
	{
		value: TracesAggregatorOperator.AVG,
		label: '平均',
	},
	{
		value: TracesAggregatorOperator.MAX,
		label: '最大限度',
	},
	{
		value: TracesAggregatorOperator.MIN,
		label: '最小',
	},
	{
		value: TracesAggregatorOperator.P05,
		label: 'P05',
	},
	{
		value: TracesAggregatorOperator.P10,
		label: 'P10',
	},
	{
		value: TracesAggregatorOperator.P20,
		label: 'P20',
	},
	{
		value: TracesAggregatorOperator.P25,
		label: 'P25',
	},
	{
		value: TracesAggregatorOperator.P50,
		label: 'P50',
	},
	{
		value: TracesAggregatorOperator.P75,
		label: 'P75',
	},
	{
		value: TracesAggregatorOperator.P90,
		label: 'P90',
	},
	{
		value: TracesAggregatorOperator.P95,
		label: 'P95',
	},
	{
		value: TracesAggregatorOperator.P99,
		label: 'P99',
	},
	{
		value: TracesAggregatorOperator.RATE,
		label: '速度',
	},
	{
		value: TracesAggregatorOperator.RATE_SUM,
		label: '费率总和',
	},
	{
		value: TracesAggregatorOperator.RATE_AVG,
		label: '平均价格',
	},
	{
		value: TracesAggregatorOperator.RATE_MIN,
		label: '最低速率',
	},
	{
		value: TracesAggregatorOperator.RATE_MAX,
		label: '最大速率',
	},
];

export const logsAggregateOperatorOptions: SelectOption<string, string>[] = [
	{
		value: LogsAggregatorOperator.NOOP,
		label: 'NOOP',
	},
	{
		value: LogsAggregatorOperator.COUNT,
		label: '数数',
	},
	{
		value: LogsAggregatorOperator.COUNT_DISTINCT,
		label: '计数不同',
	},
	{
		value: LogsAggregatorOperator.SUM,
		label: '和',
	},
	{
		value: LogsAggregatorOperator.AVG,
		label: '平均',
	},
	{
		value: LogsAggregatorOperator.MAX,
		label: '最大限度',
	},
	{
		value: LogsAggregatorOperator.MIN,
		label: '最小',
	},
	{
		value: LogsAggregatorOperator.P05,
		label: 'P05',
	},
	{
		value: LogsAggregatorOperator.P10,
		label: 'P10',
	},
	{
		value: LogsAggregatorOperator.P20,
		label: 'P20',
	},
	{
		value: LogsAggregatorOperator.P25,
		label: 'P25',
	},
	{
		value: LogsAggregatorOperator.P50,
		label: 'P50',
	},
	{
		value: LogsAggregatorOperator.P75,
		label: 'P75',
	},
	{
		value: LogsAggregatorOperator.P90,
		label: 'P90',
	},
	{
		value: LogsAggregatorOperator.P95,
		label: 'P95',
	},
	{
		value: LogsAggregatorOperator.P99,
		label: 'P99',
	},
	{
		value: LogsAggregatorOperator.RATE,
		label: '速度',
	},
	{
		value: LogsAggregatorOperator.RATE_SUM,
		label: '费率总和',
	},
	{
		value: LogsAggregatorOperator.RATE_AVG,
		label: '平均价格',
	},
	{
		value: LogsAggregatorOperator.RATE_MIN,
		label: '最低速率',
	},
	{
		value: LogsAggregatorOperator.RATE_MAX,
		label: '最大速率',
	},
];

export const metricsSumAggregateOperatorOptions: SelectOption<
	string,
	string
>[] = [
	{
		value: MetricAggregateOperator.RATE,
		label: '速度',
	},
	{
		value: MetricAggregateOperator.INCREASE,
		label: '增加',
	},
];

export const metricsGaugeAggregateOperatorOptions: SelectOption<
	string,
	string
>[] = [
	{
		value: MetricAggregateOperator.LATEST,
		label: '最新的',
	},
	{
		value: MetricAggregateOperator.SUM,
		label: '和',
	},
	{
		value: MetricAggregateOperator.AVG,
		label: '平均',
	},
	{
		value: MetricAggregateOperator.MIN,
		label: '最小',
	},
	{
		value: MetricAggregateOperator.MAX,
		label: '最大限度',
	},
	{
		value: MetricAggregateOperator.COUNT,
		label: '数数',
	},
	{
		value: MetricAggregateOperator.COUNT_DISTINCT,
		label: '计数不同',
	},
];

export const metricsSumSpaceAggregateOperatorOptions: SelectOption<
	string,
	string
>[] = [
	{
		value: MetricAggregateOperator.SUM,
		label: '和',
	},
	{
		value: MetricAggregateOperator.AVG,
		label: '平均',
	},
	{
		value: MetricAggregateOperator.MIN,
		label: '最小',
	},
	{
		value: MetricAggregateOperator.MAX,
		label: '最大限度',
	},
];

export const metricsGaugeSpaceAggregateOperatorOptions: SelectOption<
	string,
	string
>[] = [
	{
		value: MetricAggregateOperator.SUM,
		label: '和',
	},
	{
		value: MetricAggregateOperator.AVG,
		label: '平均',
	},
	{
		value: MetricAggregateOperator.MIN,
		label: '最小',
	},
	{
		value: MetricAggregateOperator.MAX,
		label: '最大限度',
	},
];

export const metricsHistogramSpaceAggregateOperatorOptions: SelectOption<
	string,
	string
>[] = [
	{
		value: MetricAggregateOperator.P50,
		label: 'P50',
	},
	{
		value: MetricAggregateOperator.P75,
		label: 'P75',
	},
	{
		value: MetricAggregateOperator.P90,
		label: 'P90',
	},
	{
		value: MetricAggregateOperator.P95,
		label: 'P95',
	},
	{
		value: MetricAggregateOperator.P99,
		label: 'P99',
	},
];

export const metricsEmptyTimeAggregateOperatorOptions: SelectOption<
	string,
	string
>[] = [];

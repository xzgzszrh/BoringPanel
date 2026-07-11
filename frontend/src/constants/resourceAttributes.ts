import { OperatorValues } from 'types/reducer/trace';

export const OperatorConversions: Array<{
	label: string;
	metricValue: string;
	traceValue: OperatorValues;
}> = [
	{
		label: '在',
		metricValue: '=~',
		traceValue: 'In',
	},
	{
		label: '不在',
		metricValue: '!~',
		traceValue: 'NotIn',
	},
];

import GetMinMax, { GetMinMaxPayload } from 'lib/getMinMax';

import { Time } from '../DateTimeSelection/config';
import { CustomTimeType, Time as TimeV2 } from '../DateTimeSelectionV2/config';

export const options: IOptions[] = [
	{
		label: '关闭',
		key: 'off',
		value: 0,
	},
	{
		label: '5秒',
		key: '5s',
		value: 5000,
	},
	{
		label: '10秒',
		key: '10s',
		value: 10000,
	},
	{
		label: '30秒',
		key: '30s',
		value: 30000,
	},
	{
		label: '1分钟',
		key: '1m',
		value: 60000,
	},
	{
		label: '5分钟',
		key: '5m',
		value: 300000,
	},
	{
		label: '10分钟',
		key: '10m',
		value: 600000,
	},
	{
		label: '30分钟',
		key: '30m',
		value: 1800000,
	},
	{
		label: '1小时',
		key: '1h',
		value: 3600000,
	},
	{
		label: '2小时',
		key: '2h',
		value: 7200000,
	},
	{
		label: '1天',
		key: '1d',
		value: 86400000,
	},
];

export interface IOptions {
	label: string;
	key: string;
	value: number;
}

export const getMinMax = (
	selectedTime: Time | TimeV2 | CustomTimeType,
	minTime: number,
	maxTime: number,
): GetMinMaxPayload =>
	selectedTime !== 'custom'
		? GetMinMax(selectedTime)
		: GetMinMax(selectedTime, [minTime, maxTime]);

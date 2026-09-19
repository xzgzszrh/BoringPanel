/* eslint-disable sonarjs/no-duplicate-string */
import { QueryFunctionsTypes } from 'types/common/queryBuilder';
import { SelectOption } from 'types/common/select';

export const metricQueryFunctionOptions: SelectOption<string, string>[] = [
	{
		value: QueryFunctionsTypes.CUTOFF_MIN,
		label: '截止最小值',
	},
	{
		value: QueryFunctionsTypes.CUTOFF_MAX,
		label: '最大切断',
	},
	{
		value: QueryFunctionsTypes.CLAMP_MIN,
		label: '最小钳位',
	},
	{
		value: QueryFunctionsTypes.CLAMP_MAX,
		label: '最大钳位',
	},
	{
		value: QueryFunctionsTypes.ABSOLUTE,
		label: '绝对',
	},
	{
		value: QueryFunctionsTypes.RUNNING_DIFF,
		label: '运行差异',
	},
	{
		value: QueryFunctionsTypes.LOG_2,
		label: '对数2',
	},
	{
		value: QueryFunctionsTypes.LOG_10,
		label: '对数10',
	},
	{
		value: QueryFunctionsTypes.CUMULATIVE_SUM,
		label: '累计金额',
	},
	{
		value: QueryFunctionsTypes.EWMA_3,
		label: '欧洲气象局3',
	},
	{
		value: QueryFunctionsTypes.EWMA_5,
		label: '欧洲气象局5',
	},
	{
		value: QueryFunctionsTypes.EWMA_7,
		label: '欧洲气象局7',
	},
	{
		value: QueryFunctionsTypes.MEDIAN_3,
		label: '中位数 3',
	},
	{
		value: QueryFunctionsTypes.MEDIAN_5,
		label: '中位数 5',
	},
	{
		value: QueryFunctionsTypes.MEDIAN_7,
		label: '中位数 7',
	},
	{
		value: QueryFunctionsTypes.TIME_SHIFT,
		label: '时移',
	},
	{
		value: QueryFunctionsTypes.TIME_SHIFT,
		label: '时移',
	},
];

export const logsQueryFunctionOptions: SelectOption<string, string>[] = [
	{
		value: QueryFunctionsTypes.TIME_SHIFT,
		label: '时移',
	},
];
interface QueryFunctionConfigType {
	[key: string]: {
		showInput: boolean;
		inputType?: string;
		placeholder?: string;
		disabled?: boolean;
	};
}

export const queryFunctionsTypesConfig: QueryFunctionConfigType = {
	anomaly: {
		showInput: false,
		disabled: true,
	},
	cutOffMin: {
		showInput: true,
		inputType: 'text',
		placeholder: '临界点',
	},
	cutOffMax: {
		showInput: true,
		inputType: 'text',
		placeholder: '临界点',
	},
	clampMin: {
		showInput: true,
		inputType: 'text',
		placeholder: '临界点',
	},
	clampMax: {
		showInput: true,
		inputType: 'text',
		placeholder: '临界点',
	},
	absolute: {
		showInput: false,
	},
	runningDiff: {
		showInput: false,
	},
	log2: {
		showInput: false,
	},
	log10: {
		showInput: false,
	},
	cumSum: {
		showInput: false,
	},
	ewma3: {
		showInput: true,
		inputType: 'text',
		placeholder: '阿尔法',
	},
	ewma5: {
		showInput: true,
		inputType: 'text',
		placeholder: '阿尔法',
	},
	ewma7: {
		showInput: true,
		inputType: 'text',
		placeholder: '阿尔法',
	},
	median3: {
		showInput: false,
	},
	median5: {
		showInput: false,
	},
	median7: {
		showInput: false,
	},
	timeShift: {
		showInput: true,
		inputType: 'text',
	},
};

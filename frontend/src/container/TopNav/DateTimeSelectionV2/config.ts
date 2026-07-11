/* eslint-disable sonarjs/no-duplicate-string */
import ROUTES from 'constants/routes';

type FiveMin = '5m';
type TenMin = '10m';
type FifteenMin = '15m';
type ThirtyMin = '30m';
type FortyFiveMin = '45m';
type OneMin = '1m';
type ThreeHour = '3h';
type SixHour = '6h';
type OneHour = '1h';
type FourHour = '4h';
type TwelveHour = '12h';
type OneDay = '1d';
type ThreeDay = '3d';
type FourDay = '4d';
type TenDay = '10d';
type OneWeek = '1w';
type TwoWeek = '2w';
type SixWeek = '6w';
type OneMonth = '1month';
type TwoMonths = '2months';
type Custom = 'custom';

export type Time =
	| FiveMin
	| TenMin
	| FifteenMin
	| ThirtyMin
	| OneMin
	| ThreeHour
	| FourHour
	| SixHour
	| OneHour
	| Custom
	| OneWeek
	| SixWeek
	| OneDay
	| FourDay
	| ThreeDay
	| FortyFiveMin
	| TwelveHour
	| TenDay
	| TwoWeek
	| OneMonth
	| TwoMonths;

export type TimeUnit = 'm' | 'h' | 'd' | 'w';

export type CustomTimeType = `${string}${TimeUnit}`;

export const Options: Option[] = [
	{ value: '5m', label: '最后 5 分钟' },
	{ value: '15m', label: '最后 15 分钟' },
	{ value: '30m', label: '最后 30 分钟' },
	{ value: '1h', label: '最后 1 小时' },
	{ value: '6h', label: '最后 6 小时' },
	{ value: '1d', label: '最后 1 天' },
	{ value: '3d', label: '过去 3 天' },
	{ value: '1w', label: '过去 1 周' },
	{ value: '1month', label: '过去 1 个月' },
	{ value: 'custom', label: '自定义' },
];

export interface Option {
	value: Time;
	label: string;
}

export const OLD_RELATIVE_TIME_VALUES = [
	'1min',
	'10min',
	'15min',
	'1hr',
	'30min',
	'45min',
	'5min',
	'1day',
	'3days',
	'4days',
	'10days',
	'1week',
	'2weeks',
	'6weeks',
	'3hr',
	'4hr',
	'6hr',
	'12hr',
];

export const RelativeDurationOptions: Option[] = [
	{ value: '5m', label: '最后 5 分钟' },
	{ value: '15m', label: '最后 15 分钟' },
	{ value: '30m', label: '最后 30 分钟' },
	{ value: '1h', label: '最后 1 小时' },
	{ value: '6h', label: '最后 6 小时' },
	{ value: '1d', label: '最后 1 天' },
	{ value: '3d', label: '过去 3 天' },
	{ value: '1w', label: '过去 1 周' },
	{ value: '1month', label: '过去 1 个月' },
];

export const RelativeDurationSuggestionOptions: Option[] = [
	{ value: '3h', label: '最后 3 小时' },
	{ value: '4d', label: '过去 4 天' },
	{ value: '6w', label: '过去 6 周' },
	{ value: '12h', label: '过去 12 小时' },
	{ value: '10d', label: '过去 10 天' },
	{ value: '2w', label: '过去 2 周' },
	{ value: '2months', label: '过去 2 个月' },
	{ value: '1d', label: '今天' },
];
export const FixedDurationSuggestionOptions: Option[] = [
	{ value: '45m', label: '最后 45 分钟' },
	{ value: '12h', label: '过去 12 小时' },
	{ value: '10d', label: '过去 10 天' },
	{ value: '2w', label: '过去 2 周' },
	{ value: '2months', label: '过去 2 个月' },
	{ value: '1d', label: '今天' },
];

export const convertOldTimeToNewValidCustomTimeFormat = (
	time: string,
): CustomTimeType => {
	const regex = /^(\d+)([a-zA-Z]+)/;
	const match = regex.exec(time);

	if (match) {
		let unit = 'm';

		switch (match[2]) {
			case 'min':
				unit = 'm';
				break;
			case 'hr':
				unit = 'h';
				break;
			case 'day':
			case 'days':
				unit = 'd';
				break;
			case 'week':
			case 'weeks':
				unit = 'w';
				break;

			default:
				break;
		}

		return `${match[1]}${unit}` as CustomTimeType;
	}

	return '30m';
};

export const getDefaultOption = (route: string): Time => {
	if (route === ROUTES.SERVICE_MAP) {
		return RelativeDurationOptions[2].value;
	}
	if (route === ROUTES.APPLICATION) {
		return Options[2].value;
	}
	return Options[2].value;
};

export const getOptions = (routes: string): Option[] => {
	if (routes === ROUTES.SERVICE_MAP) {
		return RelativeDurationOptions;
	}
	return Options;
};

export const routesToHideBreadCrumbs = [ROUTES.ALL_DASHBOARD];

export const routesToSkip = [
	ROUTES.SETTINGS,
	ROUTES.LIST_ALL_ALERT,
	ROUTES.TRACE_DETAIL,
	ROUTES.ALL_CHANNELS,
	ROUTES.USAGE_EXPLORER,
	ROUTES.GET_STARTED,
	ROUTES.GET_STARTED_APPLICATION_MONITORING,
	ROUTES.GET_STARTED_INFRASTRUCTURE_MONITORING,
	ROUTES.GET_STARTED_LOGS_MANAGEMENT,
	ROUTES.GET_STARTED_AWS_MONITORING,
	ROUTES.GET_STARTED_AZURE_MONITORING,
	ROUTES.VERSION,
	ROUTES.ALL_DASHBOARD,
	ROUTES.ORG_SETTINGS,
	ROUTES.DEBUG_MODE,
	ROUTES.INGESTION_SETTINGS,
	ROUTES.API_KEYS,
	ROUTES.ERROR_DETAIL,
	ROUTES.LOGS_PIPELINES,
	ROUTES.LOGS,
	ROUTES.MY_SETTINGS,
	ROUTES.LOGS_SAVE_VIEWS,
	ROUTES.LOGS_PIPELINES,
	ROUTES.TRACES_EXPLORER,
	ROUTES.TRACES_SAVE_VIEWS,
	ROUTES.SHORTCUTS,
	ROUTES.INTEGRATIONS,
	ROUTES.DASHBOARD,
	ROUTES.DASHBOARD_WIDGET,
	ROUTES.SERVICE_TOP_LEVEL_OPERATIONS,
	ROUTES.ALERT_HISTORY,
	ROUTES.ALERT_OVERVIEW,
	ROUTES.MESSAGING_QUEUES,
	ROUTES.MESSAGING_QUEUES_DETAIL,
	ROUTES.INFRASTRUCTURE_MONITORING_HOSTS,
];

export const routesToDisable = [ROUTES.LOGS_EXPLORER, ROUTES.LIVE_LOGS];

export interface LocalStorageTimeRange {
	localstorageStartTime: string | null;
	localstorageEndTime: string | null;
}

export interface TimeRange {
	startTime: string;
	endTime: string;
}

export enum LexicalContext {
	CUSTOM_DATE_PICKER = 'customDatePicker',
	CUSTOM_DATE_TIME_INPUT = 'customDateTimeInput',
}

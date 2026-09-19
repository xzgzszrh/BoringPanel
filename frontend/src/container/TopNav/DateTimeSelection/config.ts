import ROUTES from 'constants/routes';

type FiveMin = '5m';
type TenMin = '10m';
type FifteenMin = '15m';
type ThirtyMin = '30m';
type OneMin = '1m';
type SixHour = '6h';
type OneHour = '1h';
type FourHour = '4h';
type ThreeHour = '3h';
type TwelveHour = '12h';
type OneDay = '1d';
type ThreeDay = '3d';
type OneWeek = '1w';
type Custom = 'custom';

export type Time =
	| FiveMin
	| TenMin
	| FifteenMin
	| ThirtyMin
	| OneMin
	| FourHour
	| SixHour
	| OneHour
	| ThreeHour
	| Custom
	| OneWeek
	| OneDay
	| TwelveHour
	| ThreeDay;

export const Options: Option[] = [
	{ value: '5m', label: '最后 5 分钟' },
	{ value: '15m', label: '最后 15 分钟' },
	{ value: '30m', label: '最后 30 分钟' },
	{ value: '1h', label: '最后 1 小时' },
	{ value: '6h', label: '最后 6 小时' },
	{ value: '1d', label: '最后 1 天' },
	{ value: '3d', label: '过去 3 天' },
	{ value: '1w', label: '过去 1 周' },
	{ value: 'custom', label: '自定义' },
];

type TimeFrame = {
	'5min': string;
	'15min': string;
	'30min': string;
	'1hr': string;
	'6hr': string;
	'1day': string;
	'3days': string;
	'1week': string;
	[key: string]: string; // Index signature to allow any string as index
};

export const RelativeTimeMap: TimeFrame = {
	'5min': '5m',
	'15min': '15m',
	'30min': '30m',
	'1hr': '1h',
	'6hr': '6h',
	'1day': '1d',
	'3days': '3d',
	'1week': '1w',
};

export interface Option {
	value: Time;
	label: string;
}

export const RelativeDurationOptions: Option[] = [
	{ value: '5m', label: '最后 5 分钟' },
	{ value: '15m', label: '最后 15 分钟' },
	{ value: '30m', label: '最后 30 分钟' },
	{ value: '1h', label: '最后 1 小时' },
	{ value: '6h', label: '最后 6 小时' },
	{ value: '1d', label: '最后 1 天' },
	{ value: '3d', label: '过去 3 天' },
	{ value: '1w', label: '过去 1 周' },
];

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
	ROUTES.INGESTION_SETTINGS,
	ROUTES.ERROR_DETAIL,
	ROUTES.LOGS_PIPELINES,
	ROUTES.LOGS,
	ROUTES.MY_SETTINGS,
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

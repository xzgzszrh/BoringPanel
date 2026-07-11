export enum ColumnKey {
	Application = 'serviceName',
	P99 = 'p99',
	ErrorRate = 'errorRate',
	Operations = 'callRate',
}

export const ColumnTitle: Record<ColumnKey, string> = {
	[ColumnKey.Application]: '应用',
	[ColumnKey.P99]: 'P99 延迟（毫秒）',
	[ColumnKey.ErrorRate]: '错误率（占总量百分比）',
	[ColumnKey.Operations]: '每秒操作数',
};

export enum ColumnWidth {
	Application = 200,
	P99 = 150,
	ErrorRate = 150,
	Operations = 150,
}

export const SORTING_ORDER = 'descend';

export const SEARCH_PLACEHOLDER = '搜索服务';

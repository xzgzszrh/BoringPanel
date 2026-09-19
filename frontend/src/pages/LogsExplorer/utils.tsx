import {
	FiltersType,
	IQuickFiltersConfig,
} from 'components/QuickFilters/QuickFilters';
import { DataTypes } from 'types/api/queryBuilder/queryAutocompleteResponse';
import { Query } from 'types/api/queryBuilder/queryBuilderData';

export const prepareQueryWithDefaultTimestamp = (query: Query): Query => ({
	...query,
	builder: {
		...query.builder,
		queryData: query.builder.queryData?.map((item) => ({
			...item,
			orderBy: [{ columnName: 'timestamp', order: 'desc' }],
		})),
	},
});

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum SELECTED_VIEWS {
	SEARCH = 'search',
	QUERY_BUILDER = 'query-builder',
	CLICKHOUSE = 'clickhouse',
}

export const LogsQuickFiltersConfig: IQuickFiltersConfig[] = [
	{
		type: FiltersType.CHECKBOX,
		title: '严重性文本',
		attributeKey: {
			key: 'severity_text',
			dataType: DataTypes.String,
			type: '',
			isColumn: false,
			isJSON: false,
			id: 'severity_text--string----true',
		},
		defaultOpen: true,
	},
	{
		type: FiltersType.CHECKBOX,
		title: '环境',
		attributeKey: {
			key: 'deployment.environment',
			dataType: DataTypes.String,
			type: 'resource',
			isColumn: false,
			isJSON: false,
		},
		defaultOpen: false,
	},
	{
		type: FiltersType.CHECKBOX,
		title: '服务名称',
		attributeKey: {
			key: 'service.name',
			dataType: DataTypes.String,
			type: 'resource',
			isColumn: false,
			isJSON: false,
			id: 'service.name--string--resource--true',
		},
		defaultOpen: false,
	},
	{
		type: FiltersType.CHECKBOX,
		title: '主机名',
		attributeKey: {
			key: 'host.name',
			dataType: DataTypes.String,
			type: 'resource',
			isColumn: false,
			isJSON: false,
		},
		defaultOpen: false,
	},
	{
		type: FiltersType.CHECKBOX,
		title: 'K8s集群名称',
		attributeKey: {
			key: 'k8s.cluster.name',
			dataType: DataTypes.String,
			type: 'resource',
			isColumn: false,
			isJSON: false,
		},
		defaultOpen: false,
	},
	{
		type: FiltersType.CHECKBOX,
		title: 'K8s部署名称',
		attributeKey: {
			key: 'k8s.deployment.name',
			dataType: DataTypes.String,
			type: 'resource',
			isColumn: false,
			isJSON: false,
		},
		defaultOpen: false,
	},
	{
		type: FiltersType.CHECKBOX,
		title: 'K8s命名空间名称',
		attributeKey: {
			key: 'k8s.namespace.name',
			dataType: DataTypes.String,
			type: 'resource',
			isColumn: false,
			isJSON: false,
		},
		defaultOpen: false,
	},
];

import { Typography } from 'antd';
import { ColumnsType } from 'antd/es/table';
import ROUTES from 'constants/routes';
import { getMs } from 'container/Trace/Filters/Panel/PanelBody/Duration/util';
import { DEFAULT_PER_PAGE_OPTIONS } from 'hooks/queryPagination';
import { generatePath, Link } from 'react-router-dom';
import { ListItem } from 'types/api/widgets/getQuery';

export const PER_PAGE_OPTIONS: number[] = [10, ...DEFAULT_PER_PAGE_OPTIONS];

export const columns: ColumnsType<ListItem['data']> = [
	{
		title: '根服务名称',
		dataIndex: 'subQuery.serviceName',
		key: 'serviceName',
	},
	{
		title: '根操作名称',
		dataIndex: 'subQuery.name',
		key: 'name',
	},
	{
		title: '根持续时间（以毫秒为单位）',
		dataIndex: 'subQuery.durationNano',
		key: 'durationNano',
		render: (duration: number): JSX.Element => (
			<Typography>{getMs(String(duration))}多发性硬化症</Typography>
		),
	},
	{
		title: '跨度数',
		dataIndex: 'span_count',
		key: 'span_count',
	},
	{
		title: '追踪ID',
		dataIndex: 'traceID',
		key: 'traceID',
		render: (traceID: string): JSX.Element => (
			<Link
				to={generatePath(ROUTES.TRACE_DETAIL, {
					id: traceID,
				})}
				data-testid="trace-id"
			>
				{traceID}
			</Link>
		),
	},
];

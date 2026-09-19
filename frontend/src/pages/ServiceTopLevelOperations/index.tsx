import './ServiceTopLevelOperations.styles.scss';

import { SyncOutlined } from '@ant-design/icons';
import { Alert, Table, Typography } from 'antd';
import ROUTES from 'constants/routes';
import { IServiceName } from 'container/MetricsApplication/Tabs/types';
import useErrorNotification from 'hooks/useErrorNotification';
import { useQueryService } from 'hooks/useQueryService';
import useResourceAttribute from 'hooks/useResourceAttribute';
import { convertRawQueriesToTraceSelectedTags } from 'hooks/useResourceAttribute/utils';
import { BarChart2 } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { AppState } from 'store/reducers';
import { GlobalReducer } from 'types/reducer/globalTime';
import { Tags } from 'types/reducer/trace';

export default function ServiceTopLevelOperations(): JSX.Element {
	const { servicename: encodedServiceName } = useParams<IServiceName>();
	const { maxTime, minTime, selectedTime } = useSelector<
		AppState,
		GlobalReducer
	>((state) => state.globalTime);
	const servicename = decodeURIComponent(encodedServiceName);
	const { queries } = useResourceAttribute();
	const selectedTags = useMemo(
		() => (convertRawQueriesToTraceSelectedTags(queries) as Tags[]) || [],
		[queries],
	);

	const [topLevelOperations, setTopLevelOperations] = useState<string[]>([]);

	const { data, error, isLoading } = useQueryService({
		minTime,
		maxTime,
		selectedTime,
		selectedTags,
	});

	useErrorNotification(error);

	useEffect(() => {
		const selectedService = data?.find(
			(service) => service.serviceName === servicename,
		);

		setTopLevelOperations(selectedService?.dataWarning?.topLevelOps || []);
	}, [servicename, data]);

	const alertDesc = (): ReactNode => (
		<div className="">
			Scry 使用入口点 Span 计算服务的 RED 指标。唯一入口点操作的数量不应超过
			2500。数量过多通常表示检测配置存在问题。请确保 Span 名称不包含动态
			ID，动态值应放入 Span 属性。
		</div>
	);

	const columns = [
		{
			title: '顶级运营',
			key: 'top-level-operation',
			render: (operation: string): JSX.Element => (
				<div className="top-level-operations-list-item" key={operation}>
					<Typography.Text> {operation} </Typography.Text>
				</div>
			),
		},
	];

	return (
		<div className="container">
			<Typography.Title level={5} className="top-level-operations-header">
				<Link to={ROUTES.APPLICATION}>
					<span className="breadcrumb">
						{' '}
						<BarChart2 size={12} /> 服务{' '}
					</span>
				</Link>
				<div className="divider">/</div>
				<Link to={`${ROUTES.APPLICATION}/${servicename}`}>
					<span className="breadcrumb">{servicename} </span>
				</Link>
			</Typography.Title>

			<div className="info-alert">
				<Alert message={alertDesc()} type="info" showIcon />
			</div>

			{isLoading && (
				<div className="loading-top-level-operations">
					<Typography.Title level={5}>
						<SyncOutlined spin /> 加载中 ...
					</Typography.Title>
				</div>
			)}

			{!isLoading && (
				<div className="top-level-operations-list">
					<Table
						columns={columns}
						bordered
						title={(): string => 'Top Level Operations'}
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						dataSource={topLevelOperations}
						loading={isLoading}
						showHeader={false}
						pagination={{
							pageSize: 100,
							hideOnSinglePage: true,
							showTotal: (total: number, range: number[]): string =>
								`${range[0]}-${range[1]} of ${total}`,
						}}
					/>
				</div>
			)}
		</div>
	);
}

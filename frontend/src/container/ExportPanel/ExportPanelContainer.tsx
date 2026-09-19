import { Button, Typography } from 'antd';
import createDashboard from 'api/dashboard/create';
import { ENTITY_VERSION_V4 } from 'constants/app';
import { useGetAllDashboard } from 'hooks/dashboard/useGetAllDashboard';
import useAxiosError from 'hooks/useAxiosError';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from 'react-query';

import { ExportPanelProps } from '.';
import {
	DashboardSelect,
	NewDashboardButton,
	SelectWrapper,
	Title,
	Wrapper,
} from './styles';
import { filterOptions, getSelectOptions } from './utils';

function ExportPanelContainer({
	isLoading,
	onExport,
}: ExportPanelProps): JSX.Element {
	const { t } = useTranslation(['dashboard']);

	const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(
		null,
	);

	const {
		data,
		isLoading: isAllDashboardsLoading,
		refetch,
	} = useGetAllDashboard();

	const handleError = useAxiosError();

	const {
		mutate: createNewDashboard,
		isLoading: createDashboardLoading,
	} = useMutation(createDashboard, {
		onSuccess: (data) => {
			if (data.payload) {
				onExport(data?.payload, true);
			}
			refetch();
		},
		onError: handleError,
	});

	const options = useMemo(() => getSelectOptions(data || []), [data]);

	const handleExportClick = useCallback((): void => {
		const currentSelectedDashboard = data?.find(
			({ uuid }) => uuid === selectedDashboardId,
		);

		onExport(currentSelectedDashboard || null, false);
	}, [data, selectedDashboardId, onExport]);

	const handleSelect = useCallback(
		(selectedDashboardValue: string): void => {
			setSelectedDashboardId(selectedDashboardValue);
		},
		[setSelectedDashboardId],
	);

	const handleNewDashboard = useCallback(async () => {
		createNewDashboard({
			title: t('new_dashboard_title', {
				ns: 'dashboard',
			}),
			uploadedGrafana: false,
			version: ENTITY_VERSION_V4,
		});
	}, [t, createNewDashboard]);

	const isDashboardLoading = isAllDashboardsLoading || createDashboardLoading;

	const isDisabled =
		isAllDashboardsLoading ||
		!options?.length ||
		!selectedDashboardId ||
		isLoading;

	return (
		<Wrapper direction="vertical">
			<Title>导出面板</Title>

			<SelectWrapper direction="horizontal">
				<DashboardSelect
					placeholder="选择仪表盘"
					options={options}
					showSearch
					loading={isDashboardLoading}
					disabled={isDashboardLoading}
					value={selectedDashboardId}
					onSelect={handleSelect}
					filterOption={filterOptions}
				/>
				<Button
					type="primary"
					loading={isLoading}
					disabled={isDisabled}
					onClick={handleExportClick}
				>
					出口
				</Button>
			</SelectWrapper>

			<Typography>
				或者使用此面板创建仪表盘 -
				<NewDashboardButton
					disabled={createDashboardLoading}
					loading={createDashboardLoading}
					type="link"
					onClick={handleNewDashboard}
				>
					新仪表盘
				</NewDashboardButton>
			</Typography>
		</Wrapper>
	);
}

export default ExportPanelContainer;

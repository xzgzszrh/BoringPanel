/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/img-redundant-alt */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import './DashboardList.styles.scss';

import { Color } from '@signozhq/design-tokens';
import {
	Button,
	Dropdown,
	Flex,
	Input,
	MenuProps,
	Modal,
	Popover,
	Skeleton,
	Switch,
	Table,
	Tag,
	Tooltip,
	Typography,
} from 'antd';
import { TableProps } from 'antd/lib';
import logEvent from 'api/common/logEvent';
import createDashboard from 'api/dashboard/create';
import { AxiosError } from 'axios';
import cx from 'classnames';
import { ENTITY_VERSION_V4 } from 'constants/app';
import ROUTES from 'constants/routes';
import { sanitizeDashboardData } from 'container/NewDashboard/DashboardDescription';
import { downloadObjectAsJson } from 'container/NewDashboard/DashboardDescription/utils';
import { Base64Icons } from 'container/NewDashboard/DashboardSettings/General/utils';
import dayjs from 'dayjs';
import { useGetAllDashboard } from 'hooks/dashboard/useGetAllDashboard';
import useComponentPermission from 'hooks/useComponentPermission';
import { useNotifications } from 'hooks/useNotifications';
import history from 'lib/history';
import { get, isEmpty, isUndefined } from 'lodash-es';
import {
	ArrowDownWideNarrow,
	ArrowUpRight,
	CalendarClock,
	Check,
	Clock4,
	Ellipsis,
	EllipsisVertical,
	Expand,
	ExternalLink,
	FileJson,
	Github,
	HdmiPort,
	LayoutGrid,
	Link2,
	Plus,
	Radius,
	RotateCw,
	Search,
} from 'lucide-react';
// #TODO: lucide will be removing brand icons like Github in future, in that case we can use simple icons
// see more: https://github.com/lucide-icons/lucide/issues/94
import { useDashboard } from 'providers/Dashboard/Dashboard';
import { useTimezone } from 'providers/Timezone';
import {
	ChangeEvent,
	Key,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { generatePath, Link } from 'react-router-dom';
import { useCopyToClipboard } from 'react-use';
import { AppState } from 'store/reducers';
import {
	Dashboard,
	IDashboardVariable,
	WidgetRow,
	Widgets,
} from 'types/api/dashboard/getAll';
import AppReducer from 'types/reducer/app';

import DashboardTemplatesModal from './DashboardTemplates/DashboardTemplatesModal';
import ImportJSON from './ImportJSON';
import { DeleteButton } from './TableComponents/DeleteButton';
import {
	DashboardDynamicColumns,
	DynamicColumns,
	filterDashboard,
} from './utils';

// eslint-disable-next-line sonarjs/cognitive-complexity
function DashboardsList(): JSX.Element {
	const {
		data: dashboardListResponse,
		isLoading: isDashboardListLoading,
		isRefetching: isDashboardListRefetching,
		error: dashboardFetchError,
		refetch: refetchDashboardList,
	} = useGetAllDashboard();

	const { role } = useSelector<AppState, AppReducer>((state) => state.app);

	const {
		listSortOrder: sortOrder,
		setListSortOrder: setSortOrder,
	} = useDashboard();

	const [searchString, setSearchString] = useState<string>(
		sortOrder.search || '',
	);
	const [action, createNewDashboard] = useComponentPermission(
		['action', 'create_new_dashboards'],
		role,
	);

	const [
		showNewDashboardTemplatesModal,
		setShowNewDashboardTemplatesModal,
	] = useState(false);

	const { t } = useTranslation('dashboard');

	const [
		isImportJSONModalVisible,
		setIsImportJSONModalVisible,
	] = useState<boolean>(false);

	const [uploadedGrafana, setUploadedGrafana] = useState<boolean>(false);
	const [isFilteringDashboards, setIsFilteringDashboards] = useState(false);
	const [isConfigureMetadataOpen, setIsConfigureMetadata] = useState<boolean>(
		false,
	);

	const getLocalStorageDynamicColumns = (): DashboardDynamicColumns => {
		const dashboardDynamicColumnsString = localStorage.getItem('dashboard');
		let dashboardDynamicColumns: DashboardDynamicColumns = {
			createdAt: true,
			createdBy: true,
			updatedAt: false,
			updatedBy: false,
		};
		if (typeof dashboardDynamicColumnsString === 'string') {
			try {
				const tempDashboardDynamicColumns = JSON.parse(
					dashboardDynamicColumnsString,
				);

				if (isEmpty(tempDashboardDynamicColumns)) {
					localStorage.setItem('dashboard', JSON.stringify(dashboardDynamicColumns));
				} else {
					dashboardDynamicColumns = { ...tempDashboardDynamicColumns };
				}
			} catch (error) {
				console.error(error);
			}
		} else {
			localStorage.setItem('dashboard', JSON.stringify(dashboardDynamicColumns));
		}

		return dashboardDynamicColumns;
	};

	const [visibleColumns, setVisibleColumns] = useState<DashboardDynamicColumns>(
		() => getLocalStorageDynamicColumns(),
	);

	function setDynamicColumnsLocalStorage(
		visibleColumns: DashboardDynamicColumns,
	): void {
		try {
			localStorage.setItem('dashboard', JSON.stringify(visibleColumns));
		} catch (error) {
			console.error(error);
		}
	}

	const [dashboards, setDashboards] = useState<Dashboard[]>();

	const sortDashboardsByCreatedAt = (dashboards: Dashboard[]): void => {
		const sortedDashboards = dashboards.sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		);
		setDashboards(sortedDashboards);
	};

	const sortDashboardsByUpdatedAt = (dashboards: Dashboard[]): void => {
		const sortedDashboards = dashboards.sort(
			(a, b) =>
				new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
		);
		setDashboards(sortedDashboards);
	};

	const sortHandle = (key: string): void => {
		if (!dashboards) return;
		if (key === 'createdAt') {
			sortDashboardsByCreatedAt(dashboards);
			setSortOrder({
				columnKey: 'createdAt',
				order: 'descend',
				pagination: sortOrder.pagination || '1',
				search: sortOrder.search || '',
			});
		} else if (key === 'updatedAt') {
			sortDashboardsByUpdatedAt(dashboards);
			setSortOrder({
				columnKey: 'updatedAt',
				order: 'descend',
				pagination: sortOrder.pagination || '1',
				search: sortOrder.search || '',
			});
		}
	};

	function handlePageSizeUpdate(page: number): void {
		setSortOrder({ ...sortOrder, pagination: String(page) });
	}

	useEffect(() => {
		const filteredDashboards = filterDashboard(
			searchString,
			dashboardListResponse || [],
		);
		if (sortOrder.columnKey === 'updatedAt') {
			sortDashboardsByUpdatedAt(filteredDashboards || []);
		} else if (sortOrder.columnKey === 'createdAt') {
			sortDashboardsByCreatedAt(filteredDashboards || []);
		} else if (sortOrder.columnKey === 'null') {
			setSortOrder({
				columnKey: 'updatedAt',
				order: 'descend',
				pagination: sortOrder.pagination || '1',
				search: sortOrder.search || '',
			});
			sortDashboardsByUpdatedAt(filteredDashboards || []);
		}
	}, [
		dashboardListResponse,
		searchString,
		setSortOrder,
		sortOrder.columnKey,
		sortOrder.pagination,
		sortOrder.search,
	]);

	const [newDashboardState, setNewDashboardState] = useState({
		loading: false,
		error: false,
		errorMessage: '',
	});

	const data: Data[] =
		dashboards?.map((e) => ({
			createdAt: e.created_at,
			description: e.data.description || '',
			id: e.uuid,
			lastUpdatedTime: e.updated_at,
			name: e.data.title,
			tags: e.data.tags || [],
			key: e.uuid,
			createdBy: e.created_by,
			isLocked: !!e.isLocked || false,
			lastUpdatedBy: e.updated_by,
			image: e.data.image || Base64Icons[0],
			variables: e.data.variables,
			widgets: e.data.widgets,
			layout: e.data.layout,
			panelMap: e.data.panelMap,
			version: e.data.version,
			refetchDashboardList,
		})) || [];

	const onNewDashboardHandler = useCallback(async () => {
		try {
			logEvent('Dashboard List: Create dashboard clicked', {});
			setNewDashboardState({
				...newDashboardState,
				loading: true,
			});
			const response = await createDashboard({
				title: t('new_dashboard_title', {
					ns: 'dashboard',
				}),
				uploadedGrafana: false,
				version: ENTITY_VERSION_V4,
			});

			if (response.statusCode === 200) {
				history.push(
					generatePath(ROUTES.DASHBOARD, {
						dashboardId: response.payload.uuid,
					}),
				);
			} else {
				setNewDashboardState({
					...newDashboardState,
					loading: false,
					error: true,
					errorMessage: response.error || 'Something went wrong',
				});
			}
		} catch (error) {
			setNewDashboardState({
				...newDashboardState,
				error: true,
				errorMessage: (error as AxiosError).toString() || 'Something went Wrong',
			});
		}
	}, [newDashboardState, t]);

	const onModalHandler = (uploadedGrafana: boolean): void => {
		logEvent('Dashboard List: Import JSON clicked', {});

		setIsImportJSONModalVisible((state) => !state);
		setUploadedGrafana(uploadedGrafana);
	};

	const handleSearch = (event: ChangeEvent<HTMLInputElement>): void => {
		setIsFilteringDashboards(true);
		const searchText = (event as React.BaseSyntheticEvent)?.target?.value || '';
		const filteredDashboards = filterDashboard(
			searchText,
			dashboardListResponse || [],
		);
		setDashboards(filteredDashboards);
		setIsFilteringDashboards(false);
		setSearchString(searchText);
		setSortOrder({ ...sortOrder, search: searchText });
	};

	const [state, setCopy] = useCopyToClipboard();

	const { notifications } = useNotifications();

	useEffect(() => {
		if (state.error) {
			notifications.error({
				message: t('something_went_wrong', {
					ns: 'common',
				}),
			});
		}

		if (state.value) {
			notifications.success({
				message: t('success', {
					ns: 'common',
				}),
			});
		}
	}, [state.error, state.value, t, notifications]);

	const { formatTimezoneAdjustedTimestamp } = useTimezone();

	function getFormattedTime(dashboard: Dashboard, option: string): string {
		return formatTimezoneAdjustedTimestamp(
			get(dashboard, option, ''),
			'MMM D, YYYY ⎯ hh:mm:ss A (UTC Z)',
		);
	}

	const onLastUpdated = (time: string): string => {
		const currentTime = dayjs();

		const lastRefresh = dayjs(time);

		const secondsDiff = currentTime.diff(lastRefresh, 'seconds');

		const minutedDiff = currentTime.diff(lastRefresh, 'minutes');
		const hoursDiff = currentTime.diff(lastRefresh, 'hours');
		const daysDiff = currentTime.diff(lastRefresh, 'days');
		const monthsDiff = currentTime.diff(lastRefresh, 'months');

		if (isEmpty(time)) {
			return `No updates yet!`;
		}

		if (monthsDiff > 0) {
			return `Last Updated ${monthsDiff} months ago`;
		}

		if (daysDiff > 0) {
			return `Last Updated ${daysDiff} days ago`;
		}

		if (hoursDiff > 0) {
			return `Last Updated ${hoursDiff} hrs ago`;
		}

		if (minutedDiff > 0) {
			return `Last Updated ${minutedDiff} mins ago`;
		}

		return `Last Updated ${secondsDiff} sec ago`;
	};

	const columns: TableProps<Data>['columns'] = [
		{
			title: '仪表盘',
			key: 'dashboard',
			render: (dashboard: Data, _, index): JSX.Element => {
				const formattedDateAndTime = formatTimezoneAdjustedTimestamp(
					dashboard.createdAt,
					'MMM D, YYYY ⎯ hh:mm:ss A (UTC Z)',
				);

				const getLink = (): string => `${ROUTES.ALL_DASHBOARD}/${dashboard.id}`;

				const onClickHandler = (event: React.MouseEvent<HTMLElement>): void => {
					event.stopPropagation();
					if (event.metaKey || event.ctrlKey) {
						window.open(getLink(), '_blank');
					} else {
						history.push(getLink());
					}
					logEvent('Dashboard List: Clicked on dashboard', {
						dashboardId: dashboard.id,
						dashboardName: dashboard.name,
					});
				};

				const handleJsonExport = (event: React.MouseEvent<HTMLElement>): void => {
					event.stopPropagation();
					event.preventDefault();
					downloadObjectAsJson(
						sanitizeDashboardData({ ...dashboard, title: dashboard.name }),
						dashboard.name,
					);
				};

				return (
					<div className="dashboard-list-item" onClick={onClickHandler}>
						<div className="title-with-action">
							<div className="dashboard-title">
								<Tooltip
									title={dashboard?.name?.length > 50 ? dashboard?.name : ''}
									placement="left"
									overlayClassName="title-toolip"
								>
									<Link
										to={getLink()}
										className="title-link"
										onClick={(e): void => e.stopPropagation()}
									>
										<img
											src={dashboard?.image || Base64Icons[0]}
											alt="仪表盘图像"
											className="dashboard-icon"
										/>
										<Typography.Text
											data-testid={`dashboard-title-${index}`}
											className="title"
										>
											{dashboard.name}
										</Typography.Text>
									</Link>
								</Tooltip>
							</div>

							<div className="tags-with-actions">
								{dashboard?.tags && dashboard.tags.length > 0 && (
									<div className="dashboard-tags">
										{dashboard.tags.slice(0, 3).map((tag) => (
											<Tag className="tag" key={tag}>
												{tag}
											</Tag>
										))}

										{dashboard.tags.length > 3 && (
											<Tag className="tag" key={dashboard.tags[3]}>
												+ <span> {dashboard.tags.length - 3} </span>
											</Tag>
										)}
									</div>
								)}
							</div>

							{action && (
								<Popover
									trigger="click"
									content={
										<div className="dashboard-action-content">
											<section className="section-1">
												<Button
													type="text"
													className="action-btn"
													icon={<Expand size={12} />}
													onClick={onClickHandler}
												>
													看法
												</Button>
												<Button
													type="text"
													className="action-btn"
													icon={<Link2 size={12} />}
													onClick={(e): void => {
														e.stopPropagation();
														e.preventDefault();
														setCopy(`${window.location.origin}${getLink()}`);
													}}
												>
													复制链接
												</Button>
												<Button
													type="text"
													className="action-btn"
													icon={<FileJson size={12} />}
													onClick={handleJsonExport}
												>
													出口JSON
												</Button>
											</section>
											<section className="section-2">
												<DeleteButton
													name={dashboard.name}
													id={dashboard.id}
													isLocked={dashboard.isLocked}
													createdBy={dashboard.createdBy}
												/>
											</section>
										</div>
									}
									placement="bottomRight"
									arrow={false}
									rootClassName="dashboard-actions"
								>
									<EllipsisVertical
										className="dashboard-action-icon"
										size={14}
										data-testid="dashboard-action-icon"
										onClick={(e): void => {
											e.stopPropagation();
											e.preventDefault();
										}}
									/>
								</Popover>
							)}
						</div>
						<div className="dashboard-details">
							<div className="dashboard-created-at">
								<CalendarClock size={14} />
								<Typography.Text>{formattedDateAndTime}</Typography.Text>
							</div>

							{dashboard.createdBy && (
								<div className="created-by">
									<div className="dashboard-tag">
										<Typography.Text className="tag-text">
											{dashboard.createdBy?.substring(0, 1).toUpperCase()}
										</Typography.Text>
									</div>
									<Typography.Text className="dashboard-created-by">
										{dashboard.createdBy}
									</Typography.Text>
								</div>
							)}
							{visibleColumns.updatedAt && (
								<div className="dashboard-created-at">
									<CalendarClock size={14} />
									<Typography.Text>
										{onLastUpdated(dashboard.lastUpdatedTime)}
									</Typography.Text>
								</div>
							)}

							{dashboard.lastUpdatedBy && visibleColumns.updatedBy && (
								<div className="updated-by">
									<Typography.Text className="text">最后更新者：</Typography.Text>
									<div className="dashboard-tag">
										<Typography.Text className="tag-text">
											{dashboard.lastUpdatedBy?.substring(0, 1).toUpperCase()}
										</Typography.Text>
									</div>
									<Typography.Text className="dashboard-created-by">
										{dashboard.lastUpdatedBy}
									</Typography.Text>
								</div>
							)}
						</div>
					</div>
				);
			},
		},
	];

	const getCreateDashboardItems = useMemo(() => {
		const menuItems: MenuProps['items'] = [
			{
				label: (
					<div
						className="create-dashboard-menu-item"
						onClick={(): void => onModalHandler(false)}
					>
						<Radius size={14} /> 进口JSON
					</div>
				),
				key: '1',
			},
		];

		if (createNewDashboard) {
			menuItems.unshift({
				label: (
					<div
						className="create-dashboard-menu-item"
						onClick={(): void => {
							onNewDashboardHandler();
						}}
					>
						<LayoutGrid size={14} /> 创建仪表盘
					</div>
				),
				key: '0',
			});
		}

		return menuItems;
	}, [createNewDashboard, onNewDashboardHandler]);

	const showPaginationItem = (total: number, range: number[]): JSX.Element => (
		<>
			<Typography.Text className="numbers">
				{range[0]} &#8212; {range[1]}
			</Typography.Text>
			<Typography.Text className="total">的 {total}</Typography.Text>
		</>
	);

	const paginationConfig = data.length > 20 && {
		pageSize: 20,
		showTotal: showPaginationItem,
		showSizeChanger: false,
		onChange: (page: any): void => handlePageSizeUpdate(page),
		current: Number(sortOrder.pagination),
		defaultCurrent: Number(sortOrder.pagination) || 1,
		hideOnSinglePage: true,
	};

	const logEventCalledRef = useRef(false);
	useEffect(() => {
		if (
			!logEventCalledRef.current &&
			!isDashboardListLoading &&
			!isUndefined(dashboardListResponse)
		) {
			logEvent('Dashboard List: Page visited', {
				number: dashboardListResponse?.length,
			});
			logEventCalledRef.current = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isDashboardListLoading]);

	return (
		<div className="dashboards-list-container">
			<div className="dashboards-list-view-content">
				<div className="dashboards-list-title-container">
					<Typography.Title className="title">仪表盘</Typography.Title>
					<Flex align="center" justify="space-between">
						<Typography.Text className="subtitle">
							为您的工作区创建和管理仪表盘。
						</Typography.Text>
					</Flex>
				</div>

				{isDashboardListLoading ||
				isFilteringDashboards ||
				isDashboardListRefetching ? (
					<div className="loading-dashboard-details">
						<Skeleton.Input active size="large" className="skeleton-1" />
						<Skeleton.Input active size="large" className="skeleton-1" />
						<Skeleton.Input active size="large" className="skeleton-1" />
						<Skeleton.Input active size="large" className="skeleton-1" />
					</div>
				) : dashboardFetchError ? (
					<div className="dashboard-error-state">
						<img src="/Icons/awwSnap.svg" alt="出问题了" className="error-img" />

						<Typography.Text className="error-text">
							出了点问题：/请重试或联系支持人员。
						</Typography.Text>
						<section className="action-btns">
							<Button
								className="retry-btn"
								type="text"
								icon={<RotateCw size={16} />}
								onClick={(): Promise<any> => refetchDashboardList()}
							>
								重试
							</Button>
						</section>
					</div>
				) : dashboards?.length === 0 && !searchString ? (
					<div className="dashboard-empty-state">
						<img src="/Icons/dashboards.svg" alt="仪表盘" className="dashboard-img" />
						<section className="text">
							<Typography.Text className="no-dashboard">
								还没有仪表盘。{' '}
							</Typography.Text>
							<Typography.Text className="info">
								创建仪表盘以开始可视化您的数据
							</Typography.Text>
						</section>

						{createNewDashboard && (
							<section className="actions">
								<Dropdown
									overlayClassName="new-dashboard-menu"
									menu={{ items: getCreateDashboardItems }}
									placement="bottomRight"
									trigger={['click']}
								>
									<Button
										type="text"
										className="new-dashboard"
										icon={<Plus size={14} />}
										onClick={(): void => {
											logEvent('Dashboard List: New dashboard clicked', {});
										}}
									>
										新仪表盘
									</Button>
								</Dropdown>
							</section>
						)}
					</div>
				) : (
					<>
						<div className="dashboards-list-header-container">
							<Input
								placeholder="按名称、描述或标签搜索..."
								prefix={<Search size={12} color={Color.BG_VANILLA_400} />}
								value={searchString}
								onChange={handleSearch}
							/>
							{createNewDashboard && (
								<Dropdown
									overlayClassName="new-dashboard-menu"
									menu={{ items: getCreateDashboardItems }}
									placement="bottomRight"
									trigger={['click']}
								>
									<Button
										type="primary"
										className="periscope-btn primary btn"
										icon={<Plus size={14} />}
										onClick={(): void => {
											logEvent('Dashboard List: New dashboard clicked', {});
										}}
									>
										新仪表盘
									</Button>
								</Dropdown>
							)}
						</div>

						{dashboards?.length === 0 ? (
							<div className="no-search">
								<img src="/Icons/emptyState.svg" alt="图像" className="img" />
								<Typography.Text className="text">
									没有找到仪表盘 {searchString}。创建新的仪表盘？
								</Typography.Text>
							</div>
						) : (
							<>
								<div className="all-dashboards-header">
									<Typography.Text className="typography">所有仪表盘</Typography.Text>
									<section className="right-actions">
										<Tooltip title="种类">
											<Popover
												trigger="click"
												content={
													<div className="sort-content">
														<Typography.Text className="sort-heading">
															排序方式
														</Typography.Text>
														<Button
															type="text"
															className={cx('sort-btns')}
															onClick={(): void => sortHandle('createdAt')}
															data-testid="sort-by-last-created"
														>
															最后创建
															{sortOrder.columnKey === 'createdAt' && <Check size={14} />}
														</Button>
														<Button
															type="text"
															className={cx('sort-btns')}
															onClick={(): void => sortHandle('updatedAt')}
															data-testid="sort-by-last-updated"
														>
															最后更新
															{sortOrder.columnKey === 'updatedAt' && <Check size={14} />}
														</Button>
													</div>
												}
												rootClassName="sort-dashboards"
												placement="bottomRight"
												arrow={false}
											>
												<ArrowDownWideNarrow size={14} data-testid="sort-by" />
											</Popover>
										</Tooltip>
										<Popover
											trigger="click"
											content={
												<div className="configure-content">
													<Button
														type="text"
														icon={<HdmiPort size={14} />}
														className="configure-btn"
														onClick={(e): void => {
															e.preventDefault();
															e.stopPropagation();
															setIsConfigureMetadata(true);
														}}
													>
														配置元数据
													</Button>
												</div>
											}
											rootClassName="configure-group"
											placement="bottomRight"
											arrow={false}
										>
											<Ellipsis size={14} />
										</Popover>
									</section>
								</div>

								<Table
									columns={columns}
									dataSource={data}
									showSorterTooltip
									loading={
										isDashboardListLoading ||
										isFilteringDashboards ||
										isDashboardListRefetching
									}
									showHeader={false}
									pagination={paginationConfig}
								/>
							</>
						)}
					</>
				)}
				<ImportJSON
					isImportJSONModalVisible={isImportJSONModalVisible}
					uploadedGrafana={uploadedGrafana}
					onModalHandler={(): void => onModalHandler(false)}
				/>

				<DashboardTemplatesModal
					showNewDashboardTemplatesModal={showNewDashboardTemplatesModal}
					onCreateNewDashboard={onNewDashboardHandler}
					onCancel={(): void => {
						setShowNewDashboardTemplatesModal(false);
					}}
				/>

				<Modal
					open={isConfigureMetadataOpen}
					onCancel={(): void => {
						setIsConfigureMetadata(false);
						// reset to default if the changes are not applied
						setVisibleColumns(getLocalStorageDynamicColumns());
					}}
					title="配置元数据"
					footer={
						<Button
							type="text"
							icon={<Check size={14} />}
							className="save-changes"
							onClick={(): void => {
								setIsConfigureMetadata(false);
								setDynamicColumnsLocalStorage(visibleColumns);
							}}
						>
							保存更改
						</Button>
					}
					rootClassName="configure-metadata-root"
				>
					<div className="configure-content">
						<div className="configure-preview">
							<section className="header">
								<img
									src={dashboards?.[0]?.data?.image || Base64Icons[0]}
									alt="仪表盘图像"
									style={{ height: '14px', width: '14px' }}
								/>
								<Typography.Text className="title">
									{dashboards?.[0]?.data?.title}
								</Typography.Text>
							</section>
							<section className="details">
								<section className="createdAt">
									{visibleColumns.createdAt && (
										<Typography.Text className="formatted-time">
											<CalendarClock size={14} />
											{getFormattedTime(dashboards?.[0] as Dashboard, 'created_at')}
										</Typography.Text>
									)}
									{visibleColumns.createdBy && (
										<div className="user">
											<Typography.Text className="user-tag">
												{dashboards?.[0]?.created_by?.substring(0, 1).toUpperCase()}
											</Typography.Text>
											<Typography.Text className="dashboard-created-by">
												{dashboards?.[0]?.created_by}
											</Typography.Text>
										</div>
									)}
								</section>
								<section className="updatedAt">
									{visibleColumns.updatedAt && (
										<Typography.Text className="formatted-time">
											<CalendarClock size={14} />
											{onLastUpdated(dashboards?.[0]?.updated_at || '')}
										</Typography.Text>
									)}
									{visibleColumns.updatedBy && (
										<div className="user">
											<Typography.Text className="user-tag">
												{dashboards?.[0]?.updated_by?.substring(0, 1).toUpperCase()}
											</Typography.Text>
											<Typography.Text className="dashboard-created-by">
												{dashboards?.[0]?.updated_by}
											</Typography.Text>
										</div>
									)}
								</section>
							</section>
						</div>
						<div className="metadata-action">
							<div className="left">
								<CalendarClock size={14} />
								<Typography.Text>创建于</Typography.Text>
							</div>
							<div className="connection-line" />
							<div className="right">
								<Switch
									size="small"
									checked
									disabled
									onChange={(check): void =>
										setVisibleColumns((prev) => ({
											...prev,
											[DynamicColumns.CREATED_AT]: check,
										}))
									}
								/>
							</div>
						</div>
						<div className="metadata-action">
							<div className="left">
								<CalendarClock size={14} />
								<Typography.Text>创建者：</Typography.Text>
							</div>
							<div className="connection-line" />
							<div className="right">
								<Switch
									size="small"
									disabled
									checked
									onChange={(check): void =>
										setVisibleColumns((prev) => ({
											...prev,
											[DynamicColumns.CREATED_BY]: check,
										}))
									}
								/>
							</div>
						</div>
						<div className="metadata-action">
							<div className="left">
								<Clock4 size={14} />
								<Typography.Text>更新于</Typography.Text>
							</div>
							<div className="connection-line" />
							<div className="right">
								<Switch
									size="small"
									checked={visibleColumns.updatedAt}
									onChange={(check): void =>
										setVisibleColumns((prev) => ({
											...prev,
											[DynamicColumns.UPDATED_AT]: check,
										}))
									}
								/>
							</div>
						</div>
						<div className="metadata-action">
							<div className="left">
								<Clock4 size={14} />
								<Typography.Text>更新者</Typography.Text>
							</div>
							<div className="connection-line" />
							<div className="right">
								<Switch
									size="small"
									checked={visibleColumns.updatedBy}
									onChange={(check): void =>
										setVisibleColumns((prev) => ({
											...prev,
											[DynamicColumns.UPDATED_BY]: check,
										}))
									}
								/>
							</div>
						</div>
					</div>
				</Modal>
			</div>
		</div>
	);
}

export interface Data {
	key: Key;
	name: string;
	description: string;
	tags: string[];
	createdBy: string;
	createdAt: string;
	lastUpdatedTime: string;
	lastUpdatedBy: string;
	isLocked: boolean;
	id: string;
	image?: string;
	widgets?: Array<WidgetRow | Widgets>;
	layout?: Layout[];
	panelMap?: Record<string, { widgets: Layout[]; collapsed: boolean }>;
	variables: Record<string, IDashboardVariable>;
	version?: string;
}

export default DashboardsList;

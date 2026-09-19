/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/anchor-is-valid */
import './AppLayout.styles.scss';

import * as Sentry from '@sentry/react';
import { Flex, Typography } from 'antd';
import getUserLatestVersion from 'api/user/getLatestVersion';
import getUserVersion from 'api/user/getVersion';
import cx from 'classnames';
import OverlayScrollbar from 'components/OverlayScrollbar/OverlayScrollbar';
import ROUTES from 'constants/routes';
import SideNav from 'container/SideNav';
import TopNav from 'container/TopNav';
import { useIsDarkMode } from 'hooks/useDarkMode';
import { useNotifications } from 'hooks/useNotifications';
import ErrorBoundaryFallback from 'pages/ErrorBoundaryFallback/ErrorBoundaryFallback';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQueries } from 'react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Dispatch } from 'redux';
import { AppState } from 'store/reducers';
import AppActions from 'types/actions';
import {
	UPDATE_CURRENT_ERROR,
	UPDATE_CURRENT_VERSION,
	UPDATE_LATEST_VERSION,
	UPDATE_LATEST_VERSION_ERROR,
} from 'types/actions/app';
import AppReducer from 'types/reducer/app';

import { ChildrenContainer, Layout, LayoutContent } from './styles';
import { getRouteKey } from './utils';

// eslint-disable-next-line sonarjs/cognitive-complexity
function AppLayout(props: AppLayoutProps): JSX.Element {
	const { isLoggedIn, user } = useSelector<AppState, AppReducer>(
		(state) => state.app,
	);

	const { notifications } = useNotifications();

	const isDarkMode = useIsDarkMode();

	const { pathname } = useLocation();
	const { t } = useTranslation(['titles']);

	const [getUserVersionResponse, getUserLatestVersionResponse] = useQueries([
		{
			queryFn: getUserVersion,
			queryKey: ['getUserVersion', user?.accessJwt],
			enabled: isLoggedIn,
		},
		{
			queryFn: getUserLatestVersion,
			queryKey: ['getUserLatestVersion', user?.accessJwt],
			enabled: isLoggedIn,
		},
	]);

	useEffect(() => {
		if (getUserLatestVersionResponse.status === 'idle' && isLoggedIn) {
			getUserLatestVersionResponse.refetch();
		}

		if (getUserVersionResponse.status === 'idle' && isLoggedIn) {
			getUserVersionResponse.refetch();
		}
	}, [getUserLatestVersionResponse, getUserVersionResponse, isLoggedIn]);

	const { children } = props;

	const dispatch = useDispatch<Dispatch<AppActions | any>>();

	const latestCurrentCounter = useRef(0);
	const latestVersionCounter = useRef(0);

	useEffect(() => {
		if (
			getUserLatestVersionResponse.isFetched &&
			getUserLatestVersionResponse.isError &&
			latestCurrentCounter.current === 0
		) {
			latestCurrentCounter.current = 1;

			dispatch({
				type: UPDATE_LATEST_VERSION_ERROR,
				payload: {
					isError: true,
				},
			});
			notifications.error({
				message: t('oops_something_went_wrong_version'),
			});
		}

		if (
			getUserVersionResponse.isFetched &&
			getUserVersionResponse.isError &&
			latestVersionCounter.current === 0
		) {
			latestVersionCounter.current = 1;

			dispatch({
				type: UPDATE_CURRENT_ERROR,
				payload: {
					isError: true,
				},
			});
			notifications.error({
				message: t('oops_something_went_wrong_version'),
			});
		}

		if (
			getUserVersionResponse.isFetched &&
			getUserLatestVersionResponse.isSuccess &&
			getUserVersionResponse.data &&
			getUserVersionResponse.data.payload
		) {
			dispatch({
				type: UPDATE_CURRENT_VERSION,
				payload: {
					currentVersion: getUserVersionResponse.data.payload.version,
					ee: getUserVersionResponse.data.payload.ee,
					setupCompleted: getUserVersionResponse.data.payload.setupCompleted,
				},
			});
		}

		if (
			getUserLatestVersionResponse.isFetched &&
			getUserLatestVersionResponse.isSuccess &&
			getUserLatestVersionResponse.data &&
			getUserLatestVersionResponse.data.payload
		) {
			dispatch({
				type: UPDATE_LATEST_VERSION,
				payload: {
					latestVersion: getUserLatestVersionResponse.data.payload.tag_name,
				},
			});
		}
	}, [
		dispatch,
		isLoggedIn,
		pathname,
		t,
		getUserLatestVersionResponse.isLoading,
		getUserLatestVersionResponse.isError,
		getUserLatestVersionResponse.data,
		getUserVersionResponse.isLoading,
		getUserVersionResponse.isError,
		getUserVersionResponse.data,
		getUserLatestVersionResponse.isFetched,
		getUserVersionResponse.isFetched,
		getUserLatestVersionResponse.isSuccess,
		notifications,
	]);

	const isToDisplayLayout = isLoggedIn;

	const routeKey = useMemo(() => getRouteKey(pathname), [pathname]);
	const pageTitle = t(routeKey);
	const displayPageTitle = pageTitle.replace(/^Scry\s*\|\s*/, '');
	const renderFullScreen =
		pathname === ROUTES.GET_STARTED ||
		pathname === ROUTES.ONBOARDING ||
		pathname === ROUTES.GET_STARTED_APPLICATION_MONITORING ||
		pathname === ROUTES.GET_STARTED_INFRASTRUCTURE_MONITORING ||
		pathname === ROUTES.GET_STARTED_LOGS_MANAGEMENT ||
		pathname === ROUTES.GET_STARTED_AWS_MONITORING ||
		pathname === ROUTES.GET_STARTED_AZURE_MONITORING;

	const isLogsView = (): boolean =>
		routeKey === 'LOGS' ||
		routeKey === 'LOGS_EXPLORER' ||
		routeKey === 'LOGS_PIPELINES' ||
		routeKey === 'LOGS_SAVE_VIEWS';

	const isTracesView = (): boolean =>
		routeKey === 'TRACES_EXPLORER' || routeKey === 'TRACES_SAVE_VIEWS';

	const isMessagesAndAlerts = (): boolean =>
		[
			'LIST_ALL_ALERT',
			'ALERT_HISTORY',
			'ALERT_OVERVIEW',
			'ALL_ERROR',
			'MESSAGING_QUEUES',
			'MESSAGING_QUEUES_DETAIL',
		].includes(routeKey);

	const isDashboardListView = (): boolean => routeKey === 'ALL_DASHBOARD';
	const isAlertHistory = (): boolean => routeKey === 'ALERT_HISTORY';
	const isAlertOverview = (): boolean => routeKey === 'ALERT_OVERVIEW';
	const isInfraMonitoringHosts = (): boolean =>
		routeKey === 'INFRASTRUCTURE_MONITORING_HOSTS';
	const isPathMatch = (regex: RegExp): boolean => regex.test(pathname);

	const isDashboardView = (): boolean =>
		isPathMatch(/^\/dashboard\/[a-zA-Z0-9_-]+$/);

	const isDashboardWidgetView = (): boolean =>
		isPathMatch(/^\/dashboard\/[a-zA-Z0-9_-]+\/new$/);

	const isTraceDetailsView = (): boolean =>
		isPathMatch(/^\/trace\/[a-zA-Z0-9]+(\?.*)?$/);

	const isAIWorkspace =
		pathname === ROUTES.AI_ASSISTANT ||
		pathname === ROUTES.AI_MEMORY ||
		pathname === ROUTES.AI_LOOPS ||
		pathname.startsWith(`${ROUTES.AI_LOOPS}/`) ||
		pathname === ROUTES.AI_WORKFLOWS ||
		pathname.startsWith(`${ROUTES.AI_WORKFLOWS}/`);

	const isFullBleedContent =
		isAIWorkspace ||
		isLogsView() ||
		isTracesView() ||
		isDashboardView() ||
		isDashboardWidgetView() ||
		isDashboardListView() ||
		isAlertHistory() ||
		isAlertOverview() ||
		isMessagesAndAlerts() ||
		isInfraMonitoringHosts();
	const hideGlobalPageHeader = isAIWorkspace;

	useEffect(() => {
		if (isDarkMode) {
			document.body.classList.remove('lightMode');
			document.body.classList.add('darkMode');
		} else {
			document.body.classList.add('lightMode');
			document.body.classList.remove('darkMode');
		}
	}, [isDarkMode]);

	return (
		<Layout className={cx(isDarkMode ? 'darkMode' : 'lightMode')}>
			<Helmet>
				<title>{pageTitle}</title>
			</Helmet>

			<Flex className={cx('app-layout', isDarkMode ? 'darkMode' : 'lightMode')}>
				{isToDisplayLayout && !renderFullScreen && <SideNav />}
				<div className="app-content" data-overlayscrollbars-initialize>
					<Sentry.ErrorBoundary fallback={<ErrorBoundaryFallback />}>
						<LayoutContent data-overlayscrollbars-initialize>
							<OverlayScrollbar>
								<ChildrenContainer className="page-shell">
									{isToDisplayLayout && !renderFullScreen && !hideGlobalPageHeader && (
										<div
											className={cx('global-page-header', {
												'global-page-header--full-bleed': isFullBleedContent,
											})}
										>
											<Typography.Title level={4}>{displayPageTitle}</Typography.Title>
											<TopNav />
										</div>
									)}
									<div
										className={cx('global-page-body', {
											'global-page-body--full-bleed': isFullBleedContent,
											'global-page-body--trace-detail': isTraceDetailsView(),
										})}
									>
										{children}
									</div>
								</ChildrenContainer>
							</OverlayScrollbar>
						</LayoutContent>
					</Sentry.ErrorBoundary>
				</div>
			</Flex>
		</Layout>
	);
}

interface AppLayoutProps {
	children: ReactNode;
}

export default AppLayout;

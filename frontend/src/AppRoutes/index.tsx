import { ConfigProvider } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import getLocalStorageApi from 'api/browser/localstorage/get';
import setLocalStorageApi from 'api/browser/localstorage/set';
import logEvent from 'api/common/logEvent';
import getAllOrgPreferences from 'api/preferences/getAllOrgPreferences';
import NotFound from 'components/NotFound';
import Spinner from 'components/Spinner';
import { FeatureKeys } from 'constants/features';
import { LOCALSTORAGE } from 'constants/localStorage';
import ROUTES from 'constants/routes';
import AppLayout from 'container/AppLayout';
import { KeyboardHotkeysProvider } from 'hooks/hotkeys/useKeyboardHotkeys';
import { useIsDarkMode, useThemeConfig } from 'hooks/useDarkMode';
import { THEME_MODE } from 'hooks/useDarkMode/constant';
import useGetFeatureFlag from 'hooks/useGetFeatureFlag';
import { NotificationProvider } from 'hooks/useNotifications';
import { ResourceProvider } from 'hooks/useResourceAttribute';
import history from 'lib/history';
import { pick } from 'lodash-es';
import AlertRuleProvider from 'providers/Alert';
import { DashboardProvider } from 'providers/Dashboard/Dashboard';
import { QueryBuilderProvider } from 'providers/QueryBuilder';
import { Suspense, useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { useDispatch, useSelector } from 'react-redux';
import { Route, Router, Switch } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';
import { Dispatch } from 'redux';
import { AppState } from 'store/reducers';
import AppActions from 'types/actions';
import {
	UPDATE_FEATURE_FLAG_RESPONSE,
	UPDATE_IS_FETCHING_ORG_PREFERENCES,
	UPDATE_ORG_PREFERENCES,
} from 'types/actions/app';
import AppReducer from 'types/reducer/app';
import { USER_ROLES } from 'types/roles';
import { isCloudUser } from 'utils/app';

import PrivateRoute from './Private';
import defaultRoutes, { AppRoutes } from './routes';

function App(): JSX.Element {
	const themeConfig = useThemeConfig();
	const [routes, setRoutes] = useState<AppRoutes[]>(defaultRoutes);
	const { role, isLoggedIn: isLoggedInState, user, org } = useSelector<
		AppState,
		AppReducer
	>((state) => state.app);

	const dispatch = useDispatch<Dispatch<AppActions>>();

	const isCloudUserVal = isCloudUser();

	const isDarkMode = useIsDarkMode();

	const { data: orgPreferences, isLoading: isLoadingOrgPreferences } = useQuery({
		queryFn: () => getAllOrgPreferences(),
		queryKey: ['getOrgPreferences'],
		enabled: isLoggedInState && role === USER_ROLES.ADMIN,
	});

	useEffect(() => {
		if (orgPreferences && !isLoadingOrgPreferences) {
			dispatch({
				type: UPDATE_IS_FETCHING_ORG_PREFERENCES,
				payload: {
					isFetchingOrgPreferences: false,
				},
			});

			dispatch({
				type: UPDATE_ORG_PREFERENCES,
				payload: {
					orgPreferences: orgPreferences.payload?.data || null,
				},
			});
		}
	}, [orgPreferences, dispatch, isLoadingOrgPreferences]);

	useEffect(() => {
		if (isLoggedInState && role !== USER_ROLES.ADMIN) {
			dispatch({
				type: UPDATE_IS_FETCHING_ORG_PREFERENCES,
				payload: {
					isFetchingOrgPreferences: false,
				},
			});
		}
	}, [isLoggedInState, role, dispatch]);

	const featureResponse = useGetFeatureFlag((allFlags) => {
		dispatch({
			type: UPDATE_FEATURE_FLAG_RESPONSE,
			payload: {
				featureFlag: allFlags,
				refetch: featureResponse.refetch,
			},
		});

		const isOnboardingEnabled =
			allFlags.find((flag) => flag.name === FeatureKeys.ONBOARDING)?.active ||
			false;

		if (!isOnboardingEnabled || !isCloudUserVal) {
			const newRoutes = routes.filter(
				(route) => route?.path !== ROUTES.GET_STARTED,
			);

			setRoutes(newRoutes);
		}
	});

	useEffect(() => {
		const isIdentifiedUser = getLocalStorageApi(LOCALSTORAGE.IS_IDENTIFIED_USER);

		if (
			isLoggedInState &&
			user &&
			user.userId &&
			user.email &&
			!isIdentifiedUser
		) {
			setLocalStorageApi(LOCALSTORAGE.IS_IDENTIFIED_USER, 'true');
		}

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoggedInState, user]);

	useEffect(() => {
		if (user && user?.email && user?.userId && user?.name) {
			try {
				const isThemeAnalyticsSent = getLocalStorageApi(
					LOCALSTORAGE.THEME_ANALYTICS_V1,
				);
				if (!isThemeAnalyticsSent) {
					logEvent('Theme Analytics', {
						theme: isDarkMode ? THEME_MODE.DARK : THEME_MODE.LIGHT,
						user: pick(user, ['email', 'userId', 'name']),
						org,
					});
					setLocalStorageApi(LOCALSTORAGE.THEME_ANALYTICS_V1, 'true');
				}
			} catch {
				console.error('Failed to parse local storage theme analytics event');
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user]);

	return (
		<ConfigProvider locale={zhCN} theme={themeConfig}>
			<Router history={history}>
				<CompatRouter>
					<NotificationProvider>
						<PrivateRoute>
							<ResourceProvider>
								<QueryBuilderProvider>
									<DashboardProvider>
										<KeyboardHotkeysProvider>
											<AlertRuleProvider>
												<AppLayout>
													<Suspense fallback={<Spinner size="large" tip="加载中..." />}>
														<Switch>
															{routes.map(({ path, component, exact }) => (
																<Route
																	key={`${path}`}
																	exact={exact}
																	path={path}
																	component={component}
																/>
															))}

															<Route path="*" component={NotFound} />
														</Switch>
													</Suspense>
												</AppLayout>
											</AlertRuleProvider>
										</KeyboardHotkeysProvider>
									</DashboardProvider>
								</QueryBuilderProvider>
							</ResourceProvider>
						</PrivateRoute>
					</NotificationProvider>
				</CompatRouter>
			</Router>
		</ConfigProvider>
	);
}

export default App;

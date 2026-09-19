import './MessagesAndAlerts.styles.scss';

import RouteTab from 'components/RouteTab';
import { TabRoutes } from 'components/RouteTab/types';
import ROUTES from 'constants/routes';
import history from 'lib/history';
import { BellDot, BugIcon, ListMinus } from 'lucide-react';
import AllAlertList from 'pages/AlertList';
import AllErrors from 'pages/AllErrors';
import MessagingQueues from 'pages/MessagingQueues';
import { useLocation } from 'react-router-dom';

function TabLabel({
	icon,
	label,
}: {
	icon: JSX.Element;
	label: string;
}): JSX.Element {
	return (
		<span className="messages-and-alerts-tab-label">
			{icon}
			{label}
		</span>
	);
}

const routes: TabRoutes[] = [
	{
		Component: MessagingQueues,
		name: <TabLabel icon={<ListMinus size={15} />} label="消息队列" />,
		route: ROUTES.MESSAGING_QUEUES,
		key: ROUTES.MESSAGING_QUEUES,
	},
	{
		Component: AllAlertList,
		name: <TabLabel icon={<BellDot size={15} />} label="告警" />,
		route: ROUTES.LIST_ALL_ALERT,
		key: ROUTES.LIST_ALL_ALERT,
	},
	{
		Component: AllErrors,
		name: <TabLabel icon={<BugIcon size={15} />} label="异常" />,
		route: ROUTES.ALL_ERROR,
		key: ROUTES.ALL_ERROR,
	},
];

function getActiveRoute(pathname: string): string {
	if (pathname.startsWith(ROUTES.MESSAGING_QUEUES)) {
		return ROUTES.MESSAGING_QUEUES;
	}

	if (pathname.startsWith(ROUTES.ALL_ERROR)) {
		return ROUTES.ALL_ERROR;
	}

	return ROUTES.LIST_ALL_ALERT;
}

export default function MessagesAndAlerts(): JSX.Element {
	const { pathname } = useLocation();

	return (
		<div className="messages-and-alerts-page">
			<RouteTab
				routes={routes}
				activeKey={getActiveRoute(pathname)}
				history={history}
			/>
		</div>
	);
}

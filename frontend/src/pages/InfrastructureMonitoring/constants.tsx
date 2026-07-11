import { TabRoutes } from 'components/RouteTab/types';
import ROUTES from 'constants/routes';
import InfraMonitoringHosts from 'container/InfraMonitoringHosts';
import { Inbox } from 'lucide-react';

export const Hosts: TabRoutes = {
	Component: InfraMonitoringHosts,
	name: (
		<div className="tab-item">
			<Inbox size={16} /> 主机
		</div>
	),
	route: ROUTES.INFRASTRUCTURE_MONITORING_HOSTS,
	key: ROUTES.INFRASTRUCTURE_MONITORING_HOSTS,
};

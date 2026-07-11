import { RocketOutlined } from '@ant-design/icons';
import ROUTES from 'constants/routes';
import {
	BarChart2,
	BellDot,
	Boxes,
	BugIcon,
	DraftingCompass,
	Layers2,
	LayoutGrid,
	ListMinus,
	Route,
	ScrollText,
	Settings,
	Unplug,
	// Unplug,
	UserPlus,
} from 'lucide-react';

import { SidebarItem } from './sideNav.types';

export const getStartedMenuItem = {
	key: ROUTES.GET_STARTED,
	label: '开始使用',
	icon: <RocketOutlined rotate={45} />,
};

export const inviteMemberMenuItem = {
	key: `${ROUTES.ORG_SETTINGS}#invite-team-members`,
	label: '邀请团队成员',
	icon: <UserPlus size={16} />,
};

export const shortcutMenuItem = {
	key: ROUTES.SHORTCUTS,
	label: '键盘快捷键',
	icon: <Layers2 size={16} />,
};

const menuItems: SidebarItem[] = [
	{
		key: ROUTES.APPLICATION,
		label: '服务',
		icon: <BarChart2 size={16} />,
	},
	{
		key: ROUTES.TRACES_EXPLORER,
		label: '链路',
		icon: <DraftingCompass size={16} />,
	},
	{
		key: ROUTES.LOGS,
		label: '日志',
		icon: <ScrollText size={16} />,
	},
	{
		key: ROUTES.INFRASTRUCTURE_MONITORING_HOSTS,
		label: '基础设施监控',
		icon: <Boxes size={16} />,
		isNew: true,
	},
	{
		key: ROUTES.ALL_DASHBOARD,
		label: '仪表盘',
		icon: <LayoutGrid size={16} />,
	},
	{
		key: ROUTES.MESSAGING_QUEUES,
		label: '消息队列',
		icon: <ListMinus size={16} />,
	},
	{
		key: ROUTES.LIST_ALL_ALERT,
		label: '告警',
		icon: <BellDot size={16} />,
	},
	{
		key: ROUTES.INTEGRATIONS,
		label: '集成',
		icon: <Unplug size={16} />,
	},
	{
		key: ROUTES.ALL_ERROR,
		label: '异常',
		icon: <BugIcon size={16} />,
	},
	{
		key: ROUTES.SERVICE_MAP,
		label: '服务拓扑',
		icon: <Route size={16} />,
		isBeta: true,
	},
	{
		key: ROUTES.SETTINGS,
		label: '设置',
		icon: <Settings size={16} />,
	},
];

/** Mapping of some newly added routes and their corresponding active sidebar menu key */
export const NEW_ROUTES_MENU_ITEM_KEY_MAP: Record<string, string> = {
	[ROUTES.TRACE]: ROUTES.TRACES_EXPLORER,
	[ROUTES.TRACE_EXPLORER]: ROUTES.TRACES_EXPLORER,
	[ROUTES.LOGS_BASE]: ROUTES.LOGS_EXPLORER,
};

export default menuItems;

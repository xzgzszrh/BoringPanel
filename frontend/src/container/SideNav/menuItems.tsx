import { RocketOutlined } from '@ant-design/icons';
import ROUTES from 'constants/routes';
import {
	BarChart2,
	BellDot,
	Bot,
	Boxes,
	BrainCircuit,
	DraftingCompass,
	GitBranch,
	Layers2,
	LayoutGrid,
	Route,
	ScrollText,
	Settings,
	Unplug,
	// Unplug,
} from 'lucide-react';

import { SidebarItem } from './sideNav.types';

export const getStartedMenuItem = {
	key: ROUTES.GET_STARTED,
	label: '开始使用',
	icon: <RocketOutlined rotate={45} />,
};

export const shortcutMenuItem = {
	key: ROUTES.SHORTCUTS,
	label: '键盘快捷键',
	icon: <Layers2 size={16} />,
};

export const settingsMenuItem = {
	key: ROUTES.SETTINGS,
	label: '设置',
	icon: <Settings size={16} />,
};

const menuItems: SidebarItem[] = [
	{
		key: ROUTES.AI_ASSISTANT,
		label: 'AI 助手',
		icon: <Bot size={16} />,
	},
	{
		key: ROUTES.AI_MEMORY,
		label: '记忆',
		icon: <BrainCircuit size={16} />,
	},
	{
		key: ROUTES.AI_LOOPS,
		label: 'Loop',
		icon: <GitBranch size={16} />,
	},
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
	},
	{
		key: ROUTES.ALL_DASHBOARD,
		label: '仪表盘',
		icon: <LayoutGrid size={16} />,
	},
	{
		key: ROUTES.MESSAGING_QUEUES,
		label: '消息与告警',
		icon: <BellDot size={16} />,
	},
	{
		key: ROUTES.INTEGRATIONS,
		label: '集成',
		icon: <Unplug size={16} />,
	},
	{
		key: ROUTES.SERVICE_MAP,
		label: '服务拓扑',
		icon: <Route size={16} />,
	},
];

/** Mapping of some newly added routes and their corresponding active sidebar menu key */
export const NEW_ROUTES_MENU_ITEM_KEY_MAP: Record<string, string> = {
	[ROUTES.AI_WORKFLOWS]: ROUTES.AI_LOOPS,
	[ROUTES.LIST_ALL_ALERT]: ROUTES.MESSAGING_QUEUES,
	[ROUTES.ALL_ERROR]: ROUTES.MESSAGING_QUEUES,
	[ROUTES.ERROR_DETAIL]: ROUTES.MESSAGING_QUEUES,
	[ROUTES.TRACE]: ROUTES.TRACES_EXPLORER,
	[ROUTES.TRACE_EXPLORER]: ROUTES.TRACES_EXPLORER,
	[ROUTES.LOGS_BASE]: ROUTES.LOGS_EXPLORER,
};

export default menuItems;

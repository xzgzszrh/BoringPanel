import {
	AlertFilled,
	AlignLeftOutlined,
	ApiFilled,
	BarChartOutlined,
	DashboardFilled,
	SoundFilled,
} from '@ant-design/icons';
import { Typography } from 'antd';
import Slack from 'container/SideNav/Slack';
import store from 'store';

import { TGetStartedContentSection } from './types';

export const GetStartedContent = (): TGetStartedContentSection[] => {
	const {
		app: { currentVersion },
	} = store.getState();
	return [
		{
			heading: 'Send data from your applications to Scry',
			items: [
				{
					title: '检测您的 Java 应用程序',
					icon: (
						<img src={`/Logos/java.png?currentVersion=${currentVersion}`} alt="" />
					),

					url: '',
				},
				{
					title: '检测您的 Python 应用程序',
					icon: (
						<img src={`/Logos/python.png?currentVersion=${currentVersion}`} alt="" />
					),

					url: '',
				},
				{
					title: '检测您的 JS 应用程序',
					icon: (
						<img
							src={`/Logos/javascript.png?currentVersion=${currentVersion}`}
							alt=""
						/>
					),

					url: '',
				},
				{
					title: '检测您的 Go 应用程序',
					icon: (
						<img src={`/Logos/go.png?currentVersion=${currentVersion}`} alt="" />
					),

					url: '',
				},
				{
					title: '检测您的 .NET 应用程序',
					icon: (
						<img
							src={`/Logos/ms-net-framework.png?currentVersion=${currentVersion}`}
							alt=""
						/>
					),

					url: '',
				},
				{
					title: '检测您的 PHP 应用程序',
					icon: (
						<img src={`/Logos/php.png?currentVersion=${currentVersion}`} alt="" />
					),

					url: '',
				},
				{
					title: '检测您的 Rails 应用程序',
					icon: (
						<img src={`/Logos/rails.png?currentVersion=${currentVersion}`} alt="" />
					),

					url: '',
				},
				{
					title: '检测您的 Rust 应用程序',
					icon: (
						<img src={`/Logos/rust.png?currentVersion=${currentVersion}`} alt="" />
					),

					url: '',
				},
				{
					title: '检测您的 Elixir 应用程序',
					icon: (
						<img src={`/Logos/elixir.png?currentVersion=${currentVersion}`} alt="" />
					),

					url: '',
				},
			],
		},
		{
			heading: 'Send Metrics from your Infrastructure & create Dashboards',
			items: [
				{
					title: '将指标发送到 Scry',
					icon: <BarChartOutlined style={{ fontSize: '3.5rem' }} />,
					url: '',
				},
				{
					title: '创建和管理仪表盘',
					icon: <DashboardFilled style={{ fontSize: '3.5rem' }} />,
					url: '',
				},
			],
		},
		{
			heading: 'Send your logs to Scry',
			items: [
				{
					title: '将您的日志发送到 Scry',
					icon: <AlignLeftOutlined style={{ fontSize: '3.5rem' }} />,
					url: '',
				},
				{
					title: '现有日志收集器为 Scry',
					icon: <ApiFilled style={{ fontSize: '3.5rem' }} />,
					url: '',
				},
			],
		},
		{
			heading: 'Create alerts on Metrics',
			items: [
				{
					title: '针对指标创建告警规则',
					icon: <AlertFilled style={{ fontSize: '3.5rem' }} />,
					url: '',
				},
				{
					title: '配置告警通知渠道',
					icon: <SoundFilled style={{ fontSize: '3.5rem' }} />,
					url: '',
				},
			],
		},
		{
			heading: 'Need help?',
			description: <>加入我们的 Slack 社区并提出您可能有的任何问题 或者</>,

			items: [
				{
					title: '加入 Scry 松弛社区',
					icon: (
						<div style={{ padding: '0.7rem' }}>
							<Slack width={30} height={30} />
						</div>
					),

					url: '/slack',
				},
			],
		},
	];
};

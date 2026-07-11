/* eslint-disable jsx-a11y/img-redundant-alt */
import './DashboardEmptyState.styles.scss';

import { PlusOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import logEvent from 'api/common/logEvent';
import SettingsDrawer from 'container/NewDashboard/DashboardDescription/SettingsDrawer';
import useComponentPermission from 'hooks/useComponentPermission';
import { useDashboard } from 'providers/Dashboard/Dashboard';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'store/reducers';
import AppReducer from 'types/reducer/app';
import { ROLES, USER_ROLES } from 'types/roles';
import { ComponentTypes } from 'utils/permission';

export default function DashboardEmptyState(): JSX.Element {
	const {
		selectedDashboard,
		isDashboardLocked,
		handleToggleDashboardSlider,
	} = useDashboard();

	const { user, role } = useSelector<AppState, AppReducer>((state) => state.app);
	let permissions: ComponentTypes[] = ['add_panel'];

	if (isDashboardLocked) {
		permissions = ['add_panel_locked_dashboard'];
	}

	const userRole: ROLES | null =
		selectedDashboard?.created_by === user?.email
			? (USER_ROLES.AUTHOR as ROLES)
			: role;

	const [addPanelPermission] = useComponentPermission(permissions, userRole);

	const onEmptyWidgetHandler = useCallback(() => {
		handleToggleDashboardSlider(true);
		logEvent('Dashboard Detail: Add new panel clicked', {
			dashboardId: selectedDashboard?.uuid,
			dashboardName: selectedDashboard?.data.title,
			numberOfPanels: selectedDashboard?.data.widgets?.length,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [handleToggleDashboardSlider]);
	return (
		<section className="dashboard-empty-state">
			<div className="dashboard-content">
				<section className="heading">
					<img
						src="/Icons/dashboard_emoji.svg"
						alt="标题图像"
						style={{ height: '32px', width: '32px' }}
					/>
					<Typography.Text className="welcome">欢迎使用您的新仪表盘</Typography.Text>
					<Typography.Text className="welcome-info">
						按照步骤填充数据并与您的队友共享
					</Typography.Text>
				</section>
				<section className="actions">
					<div className="actions-1">
						<div className="actions-configure">
							<div className="actions-configure-text">
								<img
									src="/Icons/tools.svg"
									alt="标题图像"
									style={{ height: '14px', width: '14px' }}
								/>
								<Typography.Text className="configure">
									配置您的新仪表盘
								</Typography.Text>
							</div>
							<Typography.Text className="configure-info">
								为其命名，添加描述、标签和变量
							</Typography.Text>
						</div>
						<SettingsDrawer drawerTitle="Dashboard Configuration" />
					</div>
					<div className="actions-1">
						<div className="actions-add-panel">
							<div className="actions-panel-text">
								<img
									src="/Icons/landscape.svg"
									alt="标题图像"
									style={{ height: '14px', width: '14px' }}
								/>
								<Typography.Text className="panel">添加面板</Typography.Text>
							</div>
							<Typography.Text className="panel-info">
								添加面板以可视化您的数据
							</Typography.Text>
						</div>
						{!isDashboardLocked && addPanelPermission && (
							<Button
								className="add-panel-btn"
								onClick={onEmptyWidgetHandler}
								icon={<PlusOutlined />}
								type="primary"
								data-testid="add-panel"
							>
								新面板
							</Button>
						)}
					</div>
				</section>
			</div>
		</section>
	);
}

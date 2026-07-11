import './IntegrationDetailPage.styles.scss';

import { Button, Modal, Typography } from 'antd';
import logEvent from 'api/common/logEvent';
import unInstallIntegration from 'api/Integrations/uninstallIntegration';
import { SOMETHING_WENT_WRONG } from 'constants/api';
import { useNotifications } from 'hooks/useNotifications';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useMutation } from 'react-query';

import { INTEGRATION_TELEMETRY_EVENTS } from '../utils';
import { ConnectionStates } from './TestConnection';

interface IntergrationsUninstallBarProps {
	integrationTitle: string;
	integrationId: string;
	refetchIntegrationDetails: () => void;
	connectionStatus: ConnectionStates;
}
function IntergrationsUninstallBar(
	props: IntergrationsUninstallBarProps,
): JSX.Element {
	const {
		integrationTitle,
		integrationId,
		refetchIntegrationDetails,
		connectionStatus,
	} = props;
	const { notifications } = useNotifications();
	const [isModalOpen, setIsModalOpen] = useState(false);

	const {
		mutate: uninstallIntegration,
		isLoading: isUninstallLoading,
	} = useMutation(unInstallIntegration, {
		onSuccess: () => {
			refetchIntegrationDetails();
			setIsModalOpen(false);
		},
		onError: () => {
			notifications.error({
				message: SOMETHING_WENT_WRONG,
			});
		},
	});

	const showModal = (): void => {
		setIsModalOpen(true);
	};

	const handleOk = (): void => {
		logEvent(
			INTEGRATION_TELEMETRY_EVENTS.INTEGRATIONS_DETAIL_REMOVE_INTEGRATION,
			{
				integration: integrationId,
				integrationStatus: connectionStatus,
			},
		);
		uninstallIntegration({
			integration_id: integrationId,
		});
	};

	const handleCancel = (): void => {
		setIsModalOpen(false);
	};
	return (
		<div className="uninstall-integration-bar">
			<div className="unintall-integration-bar-text">
				<Typography.Text className="heading">删除集成</Typography.Text>
				<Typography.Text className="subtitle">
					删除 {integrationTitle} 集成将使您的工作区停止监听来自 {integrationTitle}{' '}
					实例。
				</Typography.Text>
			</div>
			<Button
				className="uninstall-integration-btn"
				icon={<X size={14} />}
				onClick={(): void => showModal()}
			>
				从 Scry 中删除
			</Button>
			<Modal
				className="remove-integration-modal"
				open={isModalOpen}
				title="删除集成"
				onOk={handleOk}
				onCancel={handleCancel}
				okText="Remove Integration"
				okButtonProps={{
					danger: true,
					disabled: isUninstallLoading,
				}}
			>
				<Typography.Text className="remove-integration-text">
					删除此集成会使 Scry 停止侦听来自 {integrationTitle}{' '}
					实例。您仍然需要手动删除代码中的配置才能停止发送数据。
				</Typography.Text>
			</Modal>
		</div>
	);
}

export default IntergrationsUninstallBar;

import './Integrations.styles.scss';

import { LoadingOutlined } from '@ant-design/icons';
import { Button, Input, Space, Typography } from 'antd';
import logEvent from 'api/common/logEvent';
import { useNotifications } from 'hooks/useNotifications';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function RequestIntegrationBtn(): JSX.Element {
	const [
		isSubmittingRequestForIntegration,
		setIsSubmittingRequestForIntegration,
	] = useState(false);

	const [requestedIntegrationName, setRequestedIntegrationName] = useState('');

	const { notifications } = useNotifications();
	const { t } = useTranslation(['common']);

	const handleRequestIntegrationSubmit = async (): Promise<void> => {
		try {
			setIsSubmittingRequestForIntegration(true);
			const response = await logEvent('Integration Requested', {
				screen: 'Integration list page',
				integration: requestedIntegrationName,
			});

			if (response.statusCode === 200) {
				notifications.success({
					message: '已提交集成请求',
				});

				setIsSubmittingRequestForIntegration(false);
			} else {
				notifications.error({
					message:
						response.error ||
						t('something_went_wrong', {
							ns: 'common',
						}),
				});

				setIsSubmittingRequestForIntegration(false);
			}
		} catch (error) {
			notifications.error({
				message: t('something_went_wrong', {
					ns: 'common',
				}),
			});

			setIsSubmittingRequestForIntegration(false);
		}
	};

	return (
		<div className="request-entity-container">
			<Typography.Text>找不到您要找的东西？请求更多集成</Typography.Text>

			<div className="form-section">
				<Space.Compact style={{ width: '100%' }}>
					<Input
						placeholder="输入集成名称..."
						style={{ width: 300, marginBottom: 0 }}
						value={requestedIntegrationName}
						onChange={(e): void => setRequestedIntegrationName(e.target.value)}
					/>
					<Button
						className="periscope-btn primary"
						icon={
							isSubmittingRequestForIntegration ? (
								<LoadingOutlined />
							) : (
								<Check size={12} />
							)
						}
						type="primary"
						onClick={handleRequestIntegrationSubmit}
						disabled={
							isSubmittingRequestForIntegration ||
							!requestedIntegrationName ||
							requestedIntegrationName?.trim().length === 0
						}
					>
						提交
					</Button>
				</Space.Compact>
			</div>
		</div>
	);
}

import { Row, Tag, Typography } from 'antd';
import { FeatureKeys } from 'constants/features';
import useFeatureFlags from 'hooks/useFeatureFlag';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTypes } from 'types/api/alerts/alertTypes';

import { getOptionList } from './config';
import { AlertTypeCard, SelectTypeContainer } from './styles';
import { OptionType } from './types';

function SelectAlertType({ onSelect }: SelectAlertTypeProps): JSX.Element {
	const { t } = useTranslation(['alerts']);

	const isAnomalyDetectionEnabled =
		useFeatureFlags(FeatureKeys.ANOMALY_DETECTION)?.active || false;

	const optionList = getOptionList(t, isAnomalyDetectionEnabled);

	const renderOptions = useMemo(
		() => (
			<>
				{optionList.map((option: OptionType) => (
					<AlertTypeCard
						key={option.selection}
						title={option.title}
						extra={
							option.isBeta ? (
								<Tag bordered={false} color="geekblue">
									测试版
								</Tag>
							) : undefined
						}
						onClick={(): void => {
							onSelect(option.selection);
						}}
						data-testid={`alert-type-card-${option.selection}`}
					>
						{option.description}
					</AlertTypeCard>
				))}
			</>
		),
		[onSelect, optionList],
	);

	return (
		<SelectTypeContainer>
			<Typography.Title
				level={4}
				style={{
					padding: '0 8px',
				}}
			>
				{t('choose_alert_type')}
			</Typography.Title>
			<Row>{renderOptions}</Row>
		</SelectTypeContainer>
	);
}

interface SelectAlertTypeProps {
	onSelect: (typ: AlertTypes) => void;
}

export default SelectAlertType;

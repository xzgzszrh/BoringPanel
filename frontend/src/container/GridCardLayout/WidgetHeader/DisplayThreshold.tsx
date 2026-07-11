import { InfoCircleOutlined } from '@ant-design/icons';

import {
	DisplayThresholdContainer,
	TypographHeading,
	Typography,
} from './styles';
import { DisplayThresholdProps } from './types';

function DisplayThreshold({ threshold }: DisplayThresholdProps): JSX.Element {
	return (
		<DisplayThresholdContainer>
			<TypographHeading>临界点 </TypographHeading>
			<Typography>{threshold || <InfoCircleOutlined />}</Typography>
		</DisplayThresholdContainer>
	);
}

export default DisplayThreshold;

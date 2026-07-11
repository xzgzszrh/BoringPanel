import { volcano } from '@ant-design/colors';
import { WarningOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

function MissingSpansMessage(): JSX.Element {
	return (
		<Typography>
			<WarningOutlined style={{ color: volcano[6], marginRight: '0.3rem' }} />
			该链路缺少跨度，更多详细信息{' '}
		</Typography>
	);
}

export default MissingSpansMessage;

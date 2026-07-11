import { volcano } from '@ant-design/colors';
import { WarningOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

function SubTreeMessage(): JSX.Element {
	return (
		<Typography>
			<WarningOutlined style={{ color: volcano[6], marginRight: '0.3rem' }} />
			仅显示部分链路。
		</Typography>
	);
}

export default SubTreeMessage;

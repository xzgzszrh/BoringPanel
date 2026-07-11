import { Color } from '@signozhq/design-tokens';
import { Typography } from 'antd';
import { Ghost } from 'lucide-react';

const { Text } = Typography;

export default function NoLogsContainer(): React.ReactElement {
	return (
		<div className="no-logs-found">
			<Text type="secondary">
				<Ghost size={24} color={Color.BG_AMBER_500} />{' '}
				在所选时间范围内未找到该主机的日志。
			</Text>
		</div>
	);
}

import { Tag } from 'antd';

function Severity({ severity }: SeverityProps): JSX.Element {
	switch (severity) {
		case 'unprocessed': {
			return <Tag color="green">未处理</Tag>;
		}

		case 'active': {
			return <Tag color="red">射击</Tag>;
		}

		case 'suppressed': {
			return <Tag color="red">压抑</Tag>;
		}

		default: {
			return <Tag color="default">未知状态</Tag>;
		}
	}
}

interface SeverityProps {
	severity: string;
}

export default Severity;

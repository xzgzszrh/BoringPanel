import { Tag } from 'antd';
import { GettableAlert } from 'types/api/alerts/get';

function Status({ status }: StatusProps): JSX.Element {
	switch (status) {
		case 'inactive': {
			return <Tag color="green">好的</Tag>;
		}

		case 'pending': {
			return <Tag color="orange">待办的</Tag>;
		}

		case 'firing': {
			return <Tag color="red">射击</Tag>;
		}

		case 'disabled': {
			return <Tag>残疾人</Tag>;
		}

		default: {
			return <Tag color="default">未知</Tag>;
		}
	}
}

interface StatusProps {
	status: GettableAlert['state'];
}

export default Status;

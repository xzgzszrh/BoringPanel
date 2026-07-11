/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import './LogsError.styles.scss';

import { Typography } from 'antd';

export default function LogsError(): JSX.Element {
	return (
		<div className="logs-error-container">
			<div className="logs-error-content">
				<img
					src="/Icons/awwSnap.svg"
					alt="错误表情符号"
					className="error-state-svg"
				/>
				<Typography.Text>
					<span className="aww-snap">噢，快照：/ </span>{' '}
					出了点问题。请重试或联系支持人员。
				</Typography.Text>
			</div>
		</div>
	);
}

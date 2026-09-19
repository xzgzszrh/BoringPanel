import './NoLogs.styles.scss';

import { Typography } from 'antd';
import { DataSource } from 'types/common/queryBuilder';

export default function NoLogs({
	dataSource,
}: {
	dataSource: DataSource;
}): JSX.Element {
	return (
		<div className="no-logs-container">
			<div className="no-logs-container-content">
				<img
					className="eyes-emoji"
					src="/Images/eyesEmoji.svg"
					alt="眼睛表情符号"
				/>
				<Typography className="no-logs-text">
					否 {dataSource} 然而。
					<span className="sub-text">
						{' '}
						当我们收到 {dataSource}，他们会出现在这里
					</span>
				</Typography>
			</div>
		</div>
	);
}

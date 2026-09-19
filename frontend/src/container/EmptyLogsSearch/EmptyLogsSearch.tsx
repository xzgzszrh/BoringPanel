import './EmptyLogsSearch.styles.scss';

import { Typography } from 'antd';
import logEvent from 'api/common/logEvent';
import { useEffect, useRef } from 'react';
import { DataSource, PanelTypeKeys } from 'types/common/queryBuilder';

export default function EmptyLogsSearch({
	dataSource,
	panelType,
}: {
	dataSource: DataSource;
	panelType: PanelTypeKeys;
}): JSX.Element {
	const logEventCalledRef = useRef(false);
	useEffect(() => {
		if (!logEventCalledRef.current) {
			if (dataSource === DataSource.TRACES) {
				logEvent('Traces Explorer: No results', {
					panelType,
				});
			} else if (dataSource === DataSource.LOGS) {
				logEvent('Logs Explorer: No results', {
					panelType,
				});
			}
			logEventCalledRef.current = true;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="empty-logs-search-container">
			<div className="empty-logs-search-container-content">
				<img
					src="/Icons/emptyState.svg"
					alt="思考表情符号"
					className="empty-state-svg"
				/>
				<Typography.Text>
					<span className="sub-text">该查询没有结果。 </span>
					编辑您的查询并重试！
				</Typography.Text>
			</div>
		</div>
	);
}

import { SampleLogsResponse } from '../../hooks/useSampleLogs';
import LogsList from '../LogsList';

function SampleLogsResponseDisplay({
	response,
}: SampleLogsResponseDisplayProps): JSX.Element {
	const { isLoading, isError, logs } = response;

	if (isError) {
		return <div className="sample-logs-notice-container">查询示例日志时出错</div>;
	}

	if (isLoading) {
		return <div className="sample-logs-notice-container">加载中...</div>;
	}

	if (logs.length < 1) {
		return <div className="sample-logs-notice-container">没有找到日志</div>;
	}

	return <LogsList logs={logs} />;
}

export interface SampleLogsResponseDisplayProps {
	response: SampleLogsResponse;
}

export default SampleLogsResponseDisplay;

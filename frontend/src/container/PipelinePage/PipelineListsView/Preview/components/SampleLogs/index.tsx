import useSampleLogs, { SampleLogsRequest } from '../../hooks/useSampleLogs';
import LogsResponseDisplay from './SampleLogsResponseDisplay';

function SampleLogs(props: SampleLogsRequest): JSX.Element {
	const sampleLogsResponse = useSampleLogs(props);

	if ((props?.filter?.items?.length || 0) < 1) {
		return <div className="sample-logs-notice-container">请选择一个过滤器</div>;
	}

	return <LogsResponseDisplay response={sampleLogsResponse} />;
}

export default SampleLogs;

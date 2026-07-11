import './styles.scss';

import { RelativeDurationOptions } from 'container/TopNav/DateTimeSelection/config';
import { useState } from 'react';
import { TagFilter } from 'types/api/queryBuilder/queryBuilderData';

import PreviewIntervalSelector from '../components/PreviewIntervalSelector';
import SampleLogs from '../components/SampleLogs';

function LogsFilterPreview({ filter }: LogsFilterPreviewProps): JSX.Element {
	const last1HourInterval = RelativeDurationOptions[3].value;
	const [previewTimeInterval, setPreviewTimeInterval] = useState(
		last1HourInterval,
	);

	const isEmptyFilter = (filter?.items?.length || 0) < 1;

	return (
		<div>
			<div className="logs-filter-preview-header">
				<div>过滤后的日志预览</div>
				<PreviewIntervalSelector
					previewFilter={filter}
					value={previewTimeInterval}
					onChange={setPreviewTimeInterval}
				/>
			</div>
			<div className="logs-filter-preview-content">
				{isEmptyFilter ? (
					<div>请选择一个过滤器</div>
				) : (
					<SampleLogs filter={filter} timeInterval={previewTimeInterval} count={5} />
				)}
			</div>
		</div>
	);
}

interface LogsFilterPreviewProps {
	filter: TagFilter;
}

export default LogsFilterPreview;

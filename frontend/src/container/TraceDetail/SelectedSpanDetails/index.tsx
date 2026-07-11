import { Button, Modal, Row, Tabs, Tooltip, Typography } from 'antd';
import Editor from 'components/Editor';
import { StyledSpace } from 'components/Styled';
import { QueryParams } from 'constants/query';
import ROUTES from 'constants/routes';
import { useIsDarkMode } from 'hooks/useDarkMode';
import createQueryParams from 'lib/createQueryParams';
import history from 'lib/history';
import { PanelRight } from 'lucide-react';
import { Dispatch, SetStateAction, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { AppState } from 'store/reducers';
import { ITraceTree } from 'types/api/trace/getTraceItem';
import { GlobalReducer } from 'types/reducer/globalTime';

import { getTraceToLogsQuery } from './config';
import Events from './Events';
import { CardContainer, CustomSubText, styles } from './styles';
import Tags from './Tags';

function SelectedSpanDetails(props: SelectedSpanDetailsProps): JSX.Element {
	const { maxTime, minTime } = useSelector<AppState, GlobalReducer>(
		(state) => state.globalTime,
	);

	const {
		tree,
		firstSpanStartTime,
		traceStartTime = minTime,
		traceEndTime = maxTime,
		setCollapsed,
	} = props;

	const { id: traceId } = useParams<Params>();

	const isDarkMode = useIsDarkMode();

	const [isOpen, setIsOpen] = useState(false);

	const [text, setText] = useState<ModalText>({
		text: '',
		subText: '',
	});

	const onToggleHandler = (state: boolean): void => {
		setIsOpen(state);
	};

	if (!tree) {
		return <div />;
	}

	const { tags, nonChildReferences } = tree;

	const items = [
		{
			label: '标签',
			key: '1',
			children: (
				<Tags
					onToggleHandler={onToggleHandler}
					setText={setText}
					tags={tags}
					linkedSpans={nonChildReferences}
				/>
			),
		},
		{
			label: '活动',
			key: '2',
			children: (
				<Events
					events={tree.event}
					onToggleHandler={onToggleHandler}
					setText={setText}
					firstSpanStartTime={firstSpanStartTime}
				/>
			),
		},
	];

	const onLogsHandler = (): void => {
		const query = getTraceToLogsQuery(traceId, traceStartTime, traceEndTime);

		history.push(
			`${ROUTES.LOGS_EXPLORER}?${createQueryParams({
				[QueryParams.compositeQuery]: JSON.stringify(query),
				// we subtract 1000 milliseconds from the start time to handle the cases when the trace duration is in nanoseconds
				[QueryParams.startTime]: traceStartTime - 1000,
				// we add 1000 milliseconds to the end time for nano second duration traces
				[QueryParams.endTime]: traceEndTime + 1000,
			})}`,
		);
	};

	return (
		<CardContainer>
			<StyledSpace
				styledclass={[styles.selectedSpanDetailsContainer, styles.overflow]}
				direction="vertical"
			>
				<Row align="middle" justify="space-between">
					<Typography.Text strong>所选跨度的详细信息</Typography.Text>
					<Button
						className="periscope-btn nav-item-label expand-collapse-btn"
						icon={<PanelRight size={16} />}
						onClick={(): void => setCollapsed((prev) => !prev)}
					/>
				</Row>

				<Typography.Text style={{ fontWeight: 700 }}>服务</Typography.Text>

				<Typography>{tree.serviceName}</Typography>

				<Typography.Text style={{ fontWeight: 700 }}>手术</Typography.Text>

				<Typography>{tree.name}</Typography>

				<Typography.Text style={{ fontWeight: 700 }}>斯潘金德</Typography.Text>

				<Typography>{tree.spanKind}</Typography>

				<Typography.Text style={{ fontWeight: 700 }}>状态码字符串</Typography.Text>

				<Tooltip placement="left" title={tree.statusCodeString}>
					<Typography>{tree.statusCodeString}</Typography>
				</Tooltip>

				{tree.statusMessage && (
					<>
						<Typography.Text style={{ fontWeight: 700 }}>状态消息</Typography.Text>

						<Tooltip placement="left" title={tree.statusMessage}>
							<Typography>{tree.statusMessage}</Typography>
						</Tooltip>
					</>
				)}

				<Button size="small" style={{ marginTop: '8px' }} onClick={onLogsHandler}>
					转到相关日志
				</Button>
			</StyledSpace>

			<Modal
				onCancel={(): void => onToggleHandler(false)}
				title={text.text}
				open={isOpen}
				destroyOnClose
				footer={[]}
				width="70vw"
				centered
			>
				{text.text === 'exception.stacktrace' ? (
					<Editor onChange={(): void => {}} readOnly value={text.subText} />
				) : (
					<CustomSubText ellipsis={false} isDarkMode={isDarkMode}>
						{text.subText}
					</CustomSubText>
				)}
			</Modal>

			<Tabs style={{ padding: '8px' }} defaultActiveKey="1" items={items} />
		</CardContainer>
	);
}

interface SelectedSpanDetailsProps {
	tree?: ITraceTree;
	firstSpanStartTime: number;
	traceStartTime?: number;
	traceEndTime?: number;
	setCollapsed: Dispatch<SetStateAction<boolean>>;
}

SelectedSpanDetails.defaultProps = {
	tree: undefined,
	traceStartTime: undefined,
	traceEndTime: undefined,
};

export interface ModalText {
	text: string;
	subText: string;
}

interface Params {
	id: string;
}

export default SelectedSpanDetails;

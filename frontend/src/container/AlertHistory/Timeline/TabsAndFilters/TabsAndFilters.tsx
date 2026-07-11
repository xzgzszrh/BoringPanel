import './TabsAndFilters.styles.scss';

import { Color } from '@signozhq/design-tokens';
import { TimelineFilter, TimelineTab } from 'container/AlertHistory/types';
import history from 'lib/history';
import { Info } from 'lucide-react';
import Tabs2 from 'periscope/components/Tabs2';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

function ComingSoon(): JSX.Element {
	return (
		<div className="coming-soon">
			<div className="coming-soon__text">即将推出</div>
			<div className="coming-soon__icon">
				<Info size={10} color={Color.BG_SIENNA_400} />
			</div>
		</div>
	);
}
function TimelineTabs(): JSX.Element {
	const tabs = [
		{
			value: TimelineTab.OVERALL_STATUS,
			label: '整体状况',
		},
		{
			value: TimelineTab.TOP_5_CONTRIBUTORS,
			label: (
				<div className="top-5-contributors">
					前 5 名贡献者
					<ComingSoon />
				</div>
			),
			disabled: true,
		},
	];

	return <Tabs2 tabs={tabs} initialSelectedTab={TimelineTab.OVERALL_STATUS} />;
}

function TimelineFilters(): JSX.Element {
	const { search } = useLocation();
	const searchParams = useMemo(() => new URLSearchParams(search), [search]);

	const initialSelectedTab = useMemo(
		() => searchParams.get('timelineFilter') ?? TimelineFilter.ALL,
		[searchParams],
	);

	const handleFilter = (value: TimelineFilter): void => {
		searchParams.set('timelineFilter', value);
		history.push({ search: searchParams.toString() });
	};

	const tabs = [
		{
			value: TimelineFilter.ALL,
			label: '全部',
		},
		{
			value: TimelineFilter.FIRED,
			label: '被解雇',
		},
		{
			value: TimelineFilter.RESOLVED,
			label: '已解决',
		},
	];

	return (
		<Tabs2
			tabs={tabs}
			initialSelectedTab={initialSelectedTab}
			onSelectTab={handleFilter}
			hasResetButton
		/>
	);
}

function TabsAndFilters(): JSX.Element {
	return (
		<div className="timeline-tabs-and-filters">
			<TimelineTabs />
			<TimelineFilters />
		</div>
	);
}

export default TabsAndFilters;

/* eslint-disable no-nested-ternary */
import './QueryBuilderSearchV2.styles.scss';

import { Typography } from 'antd';
import {
	ArrowDown,
	ArrowUp,
	ChevronUp,
	Command,
	CornerDownLeft,
	Slash,
} from 'lucide-react';
import { TagFilter } from 'types/api/queryBuilder/queryBuilderData';
import { getUserOperatingSystem, UserOperatingSystem } from 'utils/getUserOS';

import ExampleQueriesRendererForLogs from '../QueryBuilderSearch/ExampleQueriesRendererForLogs';
import { convertExampleQueriesToOptions } from '../QueryBuilderSearch/utils';
import { ITag, Option } from './QueryBuilderSearchV2';

interface ICustomDropdownProps {
	menu: React.ReactElement;
	searchValue: string;
	tags: ITag[];
	options: Option[];
	exampleQueries: TagFilter[];
	onChange: (value: TagFilter) => void;
	currentFilterItem?: ITag;
}

export default function QueryBuilderSearchDropdown(
	props: ICustomDropdownProps,
): React.ReactElement {
	const {
		menu,
		currentFilterItem,
		searchValue,
		tags,
		exampleQueries,
		options,
		onChange,
	} = props;
	const userOs = getUserOperatingSystem();
	return (
		<>
			<div className="content">
				{!currentFilterItem?.key ? (
					<div className="suggested-filters">建议的过滤器</div>
				) : !currentFilterItem?.op ? (
					<div className="operator-for">
						<Typography.Text className="operator-for-text">运算符为 </Typography.Text>
						<Typography.Text className="operator-for-value">
							{currentFilterItem?.key?.key}
						</Typography.Text>
					</div>
				) : (
					<div className="value-for">
						<Typography.Text className="value-for-text">值用于 </Typography.Text>
						<Typography.Text className="value-for-value">
							{currentFilterItem?.key?.key} {currentFilterItem?.op}
						</Typography.Text>
					</div>
				)}
				{menu}
				{!searchValue && tags.length === 0 && (
					<div className="example-queries">
						<div className="heading"> 查询示例 </div>
						<div className="query-container">
							{convertExampleQueriesToOptions(exampleQueries).map((query) => (
								<ExampleQueriesRendererForLogs
									key={query.label}
									label={query.label}
									value={query.value}
									handleAddTag={onChange}
								/>
							))}
						</div>
					</div>
				)}
			</div>

			<div className="keyboard-shortcuts">
				<section className="navigate">
					<ArrowDown size={10} className="icons" />
					<ArrowUp size={10} className="icons" />
					<span className="keyboard-text">导航</span>
				</section>
				<section className="update-query">
					<CornerDownLeft size={10} className="icons" />
					<span className="keyboard-text">更新查询</span>
				</section>
				{!currentFilterItem?.key && options.length > 3 && (
					<section className="show-all-filter-items">
						{userOs === UserOperatingSystem.MACOS ? (
							<Command size={14} className="icons" />
						) : (
							<ChevronUp size={14} className="icons" />
						)}
						+
						<Slash size={14} className="icons" />
						<span className="keyboard-text">显示所有过滤项目</span>
					</section>
				)}
			</div>
		</>
	);
}

QueryBuilderSearchDropdown.defaultProps = {
	currentFilterItem: undefined,
};

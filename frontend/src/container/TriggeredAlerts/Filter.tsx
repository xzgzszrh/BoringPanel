/* eslint-disable react/no-unstable-nested-components */
import type { SelectProps } from 'antd';
import { Tag, Tooltip } from 'antd';
import { BaseOptionType } from 'antd/es/select';
import { useCallback, useMemo, useRef } from 'react';
import { Alerts } from 'types/api/alerts/getTriggered';

import { Container, Select } from './styles';

function TextOverflowTooltip({
	option,
}: {
	option: BaseOptionType;
}): JSX.Element {
	const contentRef = useRef<HTMLDivElement | null>(null);
	const isOverflow = contentRef.current
		? contentRef.current?.offsetWidth < contentRef.current?.scrollWidth
		: false;
	return (
		<Tooltip
			placement="left"
			title={option.value}
			// eslint-disable-next-line react/jsx-props-no-spreading
			{...(!isOverflow ? { open: false } : {})}
		>
			<div className="ant-select-item-option-content" ref={contentRef}>
				{option.value}
			</div>
		</Tooltip>
	);
}

function Filter({
	onSelectedFilterChange,
	onSelectedGroupChange,
	allAlerts,
	selectedGroup,
	selectedFilter,
}: FilterProps): JSX.Element {
	const onChangeSelectGroupHandler = useCallback(
		(value: unknown) => {
			if (typeof value === 'object' && Array.isArray(value)) {
				onSelectedGroupChange(
					value.map((e) => ({
						value: e,
					})),
				);
			}
		},
		[onSelectedGroupChange],
	);

	const onChangeSelectedFilterHandler = useCallback(
		(value: unknown) => {
			if (typeof value === 'object' && Array.isArray(value)) {
				onSelectedFilterChange(
					value.map((e) => ({
						value: e,
					})),
				);
			}
		},
		[onSelectedFilterChange],
	);

	const uniqueLabels: Array<string> = useMemo(() => {
		const allLabelsSet = new Set<string>();
		allAlerts.forEach((e) =>
			Object.keys(e.labels).forEach((e) => {
				allLabelsSet.add(e);
			}),
		);
		return [...allLabelsSet];
	}, [allAlerts]);

	const options = uniqueLabels.map((e) => ({
		value: e,
		title: '',
	}));

	const getTags: SelectProps['tagRender'] = (props): JSX.Element => {
		const { closable, onClose, label } = props;

		return (
			<Tag
				color="magenta"
				closable={closable}
				onClose={onClose}
				style={{ marginRight: 3 }}
			>
				{label}
			</Tag>
		);
	};

	return (
		<Container>
			<Select
				allowClear
				onChange={onChangeSelectedFilterHandler}
				mode="tags"
				value={selectedFilter.map((e) => e.value)}
				placeholder="按标签过滤 - 例如严重性：警告，告警名称：示例告警"
				tagRender={(props): JSX.Element => getTags(props)}
				options={[]}
			/>
			<Select
				allowClear
				onChange={onChangeSelectGroupHandler}
				mode="tags"
				defaultValue={selectedGroup.map((e) => e.value)}
				showArrow
				placeholder="按任意标签分组"
				tagRender={(props): JSX.Element => getTags(props)}
				options={options}
				optionRender={(option): JSX.Element => (
					<TextOverflowTooltip option={option} />
				)}
			/>
		</Container>
	);
}

interface FilterProps {
	onSelectedFilterChange: (value: Array<Value>) => void;
	onSelectedGroupChange: (value: Array<Value>) => void;
	allAlerts: Alerts[];
	selectedGroup: Array<Value>;
	selectedFilter: Array<Value>;
}

export interface Value {
	value: string;
}

export default Filter;

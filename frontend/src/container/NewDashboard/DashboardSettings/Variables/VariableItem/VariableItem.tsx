/* eslint-disable sonarjs/cognitive-complexity */
import './VariableItem.styles.scss';

import { orange } from '@ant-design/colors';
import { Button, Collapse, Input, Select, Switch, Tag, Typography } from 'antd';
import dashboardVariablesQuery from 'api/dashboard/variables/dashboardVariablesQuery';
import cx from 'classnames';
import Editor from 'components/Editor';
import { REACT_QUERY_KEY } from 'constants/reactQueryKeys';
import { commaValuesParser } from 'lib/dashbaordVariables/customCommaValuesParser';
import sortValues from 'lib/dashbaordVariables/sortVariableValues';
import { map } from 'lodash-es';
import {
	ArrowLeft,
	Check,
	ClipboardType,
	DatabaseZap,
	LayoutList,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import {
	IDashboardVariable,
	TSortVariableValuesType,
	TVariableQueryType,
	VariableSortTypeArr,
} from 'types/api/dashboard/getAll';
import { v4 as generateUUID } from 'uuid';

import { variablePropsToPayloadVariables } from '../../../utils';
import { TVariableMode } from '../types';
import { LabelContainer, VariableItemRow } from './styles';

const { Option } = Select;

interface VariableItemProps {
	variableData: IDashboardVariable;
	existingVariables: Record<string, IDashboardVariable>;
	onCancel: () => void;
	onSave: (mode: TVariableMode, variableData: IDashboardVariable) => void;
	validateName: (arg0: string) => boolean;
	mode: TVariableMode;
}
function VariableItem({
	variableData,
	existingVariables,
	onCancel,
	onSave,
	validateName,
	mode,
}: VariableItemProps): JSX.Element {
	const [variableName, setVariableName] = useState<string>(
		variableData.name || '',
	);
	const [variableDescription, setVariableDescription] = useState<string>(
		variableData.description || '',
	);
	const [queryType, setQueryType] = useState<TVariableQueryType>(
		variableData.type || 'QUERY',
	);
	const [variableQueryValue, setVariableQueryValue] = useState<string>(
		variableData.queryValue || '',
	);
	const [variableCustomValue, setVariableCustomValue] = useState<string>(
		variableData.customValue || '',
	);
	const [variableTextboxValue, setVariableTextboxValue] = useState<string>(
		variableData.textboxValue || '',
	);
	const [
		variableSortType,
		setVariableSortType,
	] = useState<TSortVariableValuesType>(
		variableData.sort || VariableSortTypeArr[0],
	);
	const [variableMultiSelect, setVariableMultiSelect] = useState<boolean>(
		variableData.multiSelect || false,
	);
	const [variableShowALLOption, setVariableShowALLOption] = useState<boolean>(
		variableData.showALLOption || false,
	);
	const [previewValues, setPreviewValues] = useState<string[]>([]);

	// Error messages
	const [errorName, setErrorName] = useState<boolean>(false);
	const [errorPreview, setErrorPreview] = useState<string | null>(null);

	useEffect(() => {
		if (queryType === 'CUSTOM') {
			setPreviewValues(
				sortValues(
					commaValuesParser(variableCustomValue),
					variableSortType,
				) as never,
			);
		}
		if (queryType === 'QUERY') {
			setPreviewValues((prev) => sortValues(prev, variableSortType) as never);
		}
	}, [
		queryType,
		variableCustomValue,
		variableData.customValue,
		variableData.type,
		variableSortType,
	]);

	const handleSave = (): void => {
		const variable: IDashboardVariable = {
			name: variableName,
			description: variableDescription,
			type: queryType,
			queryValue: variableQueryValue,
			customValue: variableCustomValue,
			textboxValue: variableTextboxValue,
			multiSelect: variableMultiSelect,
			showALLOption: variableShowALLOption,
			sort: variableSortType,
			...(queryType === 'TEXTBOX' && {
				selectedValue: (variableData.selectedValue ||
					variableTextboxValue) as never,
			}),
			modificationUUID: generateUUID(),
			id: variableData.id || generateUUID(),
			order: variableData.order,
		};

		onSave(mode, variable);
	};

	// Fetches the preview values for the SQL variable query
	const handleQueryResult = (response: any): void => {
		if (response?.payload?.variableValues) {
			setPreviewValues(
				sortValues(
					response.payload?.variableValues || [],
					variableSortType,
				) as never,
			);
		} else {
			setPreviewValues([]);
		}
	};

	const { isFetching: previewLoading, refetch: runQuery } = useQuery(
		[REACT_QUERY_KEY.DASHBOARD_BY_ID, variableData.name, variableName],
		{
			enabled: false,
			queryFn: () =>
				dashboardVariablesQuery({
					query: variableQueryValue || '',
					variables: variablePropsToPayloadVariables(existingVariables),
				}),
			refetchOnWindowFocus: false,
			onSuccess: (response) => {
				setErrorPreview(null);
				handleQueryResult(response);
			},
			onError: (error: {
				details: {
					error: string;
				};
			}) => {
				const { details } = error;

				if (details.error) {
					let message = details.error;
					if (details.error.includes('Syntax error:')) {
						message =
							'Please make sure query is valid and dependent variables are selected';
					}
					setErrorPreview(message);
				}
			},
		},
	);

	const handleTestRunQuery = useCallback(() => {
		runQuery();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<>
			<div className="variable-item-container">
				<div className="all-variables">
					<Button
						type="text"
						className="all-variables-btn"
						icon={<ArrowLeft size={14} />}
						onClick={onCancel}
					>
						所有变量
					</Button>
				</div>
				<div className="variable-item-content">
					<VariableItemRow className="variable-name-section">
						<LabelContainer>
							<Typography className="typography-variables">名称</Typography>
						</LabelContainer>
						<div>
							<Input
								placeholder="变量的唯一名称"
								value={variableName}
								className="name-input"
								onChange={(e): void => {
									setVariableName(e.target.value);
									setErrorName(
										!validateName(e.target.value) && e.target.value !== variableData.name,
									);
								}}
							/>
							<div>
								<Typography.Text type="warning">
									{errorName ? 'Variable name already exists' : ''}
								</Typography.Text>
							</div>
						</div>
					</VariableItemRow>
					<VariableItemRow className="variable-description-section">
						<LabelContainer>
							<Typography className="typography-variables">描述</Typography>
						</LabelContainer>

						<Input.TextArea
							value={variableDescription}
							placeholder="输入变量的描述"
							className="description-input"
							rows={3}
							onChange={(e): void => setVariableDescription(e.target.value)}
						/>
					</VariableItemRow>
					<VariableItemRow className="variable-type-section">
						<LabelContainer>
							<Typography className="typography-variables">变量类型</Typography>
						</LabelContainer>

						<div className="variable-type-btn-group">
							<Button
								type="text"
								icon={<DatabaseZap size={14} />}
								className={cx(
									// eslint-disable-next-line sonarjs/no-duplicate-string
									'variable-type-btn',
									queryType === 'QUERY' ? 'selected' : '',
								)}
								onClick={(): void => {
									setQueryType('QUERY');
									setPreviewValues([]);
								}}
							>
								询问
							</Button>
							<Button
								type="text"
								icon={<ClipboardType size={14} />}
								className={cx(
									'variable-type-btn',
									queryType === 'TEXTBOX' ? 'selected' : '',
								)}
								onClick={(): void => {
									setQueryType('TEXTBOX');
									setPreviewValues([]);
								}}
							>
								文本框
							</Button>
							<Button
								type="text"
								icon={<LayoutList size={14} />}
								className={cx(
									'variable-type-btn',
									queryType === 'CUSTOM' ? 'selected' : '',
								)}
								onClick={(): void => {
									setQueryType('CUSTOM');
									setPreviewValues([]);
								}}
							>
								自定义
							</Button>
						</div>
					</VariableItemRow>
					{queryType === 'QUERY' && (
						<div className="query-container">
							<LabelContainer>
								<Typography>询问</Typography>
							</LabelContainer>

							<div style={{ flex: 1, position: 'relative' }}>
								<Editor
									language="sql"
									value={variableQueryValue}
									onChange={(e): void => setVariableQueryValue(e)}
									height="240px"
									options={{
										fontSize: 13,
										wordWrap: 'on',
										lineNumbers: 'off',
										glyphMargin: false,
										folding: false,
										lineDecorationsWidth: 0,
										lineNumbersMinChars: 0,
										minimap: {
											enabled: false,
										},
									}}
								/>
								<Button
									type="primary"
									size="small"
									onClick={handleTestRunQuery}
									style={{
										position: 'absolute',
										bottom: 0,
									}}
									loading={previewLoading}
								>
									测试运行查询
								</Button>
							</div>
						</div>
					)}
					{queryType === 'CUSTOM' && (
						<VariableItemRow className="variable-custom-section">
							<Collapse
								collapsible="header"
								rootClassName="custom-collapse"
								defaultActiveKey={['1']}
								items={[
									{
										key: '1',
										label: '选项',
										children: (
											<Input.TextArea
												value={variableCustomValue}
												placeholder="输入以逗号分隔的选项。"
												rootClassName="comma-input"
												onChange={(e): void => {
													setVariableCustomValue(e.target.value);
													setPreviewValues(
														sortValues(
															commaValuesParser(e.target.value),
															variableSortType,
														) as never,
													);
												}}
											/>
										),
									},
								]}
							/>
						</VariableItemRow>
					)}
					{queryType === 'TEXTBOX' && (
						<VariableItemRow className="variable-textbox-section">
							<LabelContainer>
								<Typography className="typography-variables">默认值</Typography>
							</LabelContainer>
							<Input
								value={variableTextboxValue}
								className="default-input"
								onChange={(e): void => {
									setVariableTextboxValue(e.target.value);
								}}
								placeholder="输入默认值（如果有）..."
								style={{ width: 400 }}
							/>
						</VariableItemRow>
					)}
					{(queryType === 'QUERY' || queryType === 'CUSTOM') && (
						<>
							<VariableItemRow className="variables-preview-section">
								<LabelContainer style={{ width: '100%' }}>
									<Typography className="typography-variables">值预览</Typography>
								</LabelContainer>
								<div className="preview-values">
									{errorPreview ? (
										<Typography style={{ color: orange[5] }}>{errorPreview}</Typography>
									) : (
										map(previewValues, (value, idx) => (
											<Tag key={`${value}${idx}`}>{value.toString()}</Tag>
										))
									)}
								</div>
							</VariableItemRow>
							<VariableItemRow className="sort-values-section">
								<LabelContainer>
									<Typography className="typography-variables">对值进行排序</Typography>
									<Typography className="typography-sort">
										对查询输出值进行排序
									</Typography>
								</LabelContainer>

								<Select
									defaultActiveFirstOption
									defaultValue={VariableSortTypeArr[0]}
									value={variableSortType}
									onChange={(value: TSortVariableValuesType): void =>
										setVariableSortType(value)
									}
									className="sort-input"
								>
									<Option value={VariableSortTypeArr[0]}>残疾人</Option>
									<Option value={VariableSortTypeArr[1]}>升序</Option>
									<Option value={VariableSortTypeArr[2]}>降序</Option>
								</Select>
							</VariableItemRow>
							<VariableItemRow className="multiple-values-section">
								<LabelContainer>
									<Typography className="typography-variables">
										允许检查多个值
									</Typography>
								</LabelContainer>
								<Switch
									checked={variableMultiSelect}
									onChange={(e): void => {
										setVariableMultiSelect(e);
										if (!e) {
											setVariableShowALLOption(false);
										}
									}}
								/>
							</VariableItemRow>
							{variableMultiSelect && (
								<VariableItemRow className="all-option-section">
									<LabelContainer>
										<Typography className="typography-variables">
											包括所有值的选项
										</Typography>
									</LabelContainer>
									<Switch
										checked={variableShowALLOption}
										onChange={(e): void => setVariableShowALLOption(e)}
									/>
								</VariableItemRow>
							)}
						</>
					)}
				</div>
			</div>
			<div className="variable-item-footer">
				<VariableItemRow>
					<Button
						type="default"
						onClick={onCancel}
						icon={<X size={14} />}
						className="footer-btn-discard"
					>
						丢弃
					</Button>
					<Button
						type="primary"
						onClick={handleSave}
						disabled={errorName}
						icon={<Check size={14} />}
						className="footer-btn-save"
					>
						保存变量
					</Button>
				</VariableItemRow>
			</div>
		</>
	);
}

export default VariableItem;

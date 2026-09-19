import { ColumnGroupType, ColumnType } from 'antd/lib/table/interface';
import {
	HistoryData,
	PipelineData,
	ProcessorData,
} from 'types/api/pipeline/def';

import DeploymentStage from '../Layouts/ChangeHistory/DeploymentStage';
import DeploymentTime from '../Layouts/ChangeHistory/DeploymentTime';
import DescriptionTextArea from './AddNewPipeline/FormFields/DescriptionTextArea';
import FilterInput from './AddNewPipeline/FormFields/FilterInput';
import NameInput from './AddNewPipeline/FormFields/NameInput';

export const pipelineFields = [
	{
		id: 1,
		fieldName: 'Name',
		placeholder: '管道名称占位符',
		name: 'name',
		component: NameInput,
	},
	{
		id: 2,
		fieldName: 'Description',
		placeholder: 'pipeline_description_placeholder',
		name: 'description',
		component: DescriptionTextArea,
	},
	{
		id: 3,
		fieldName: 'Filter',
		placeholder: 'pipeline_filter_placeholder',
		name: 'filter',
		component: FilterInput,
	},
];

export const tagInputStyle: React.CSSProperties = {
	width: 78,
	verticalAlign: 'top',
	flex: 1,
};

export const pipelineColumns: Array<
	ColumnType<PipelineData> | ColumnGroupType<PipelineData>
> = [
	{
		key: 'orderId',
		title: '',
		dataIndex: 'orderId',
	},
	{
		key: 'name',
		title: '管道名称',
		dataIndex: 'name',
	},
	{
		key: 'filter',
		title: '过滤器',
		dataIndex: 'filter',
	},

	{
		key: 'createdAt',
		title: '最后编辑',
		dataIndex: 'createdAt',
	},
	{
		key: 'createdBy',
		title: '编辑者',
		dataIndex: 'createdBy',
	},
];

export const processorColumns: Array<
	ColumnType<ProcessorData> | ColumnGroupType<ProcessorData>
> = [
	{
		key: 'id',
		title: '',
		dataIndex: 'orderId',
		width: 150,
	},
	{
		key: 'name',
		title: '',
		dataIndex: 'name',
	},
];

export const changeHistoryColumns: Array<
	ColumnType<HistoryData> | ColumnGroupType<HistoryData>
> = [
	{
		key: 'version',
		title: '版本',
		dataIndex: 'version',
	},
	{
		title: '部署阶段',
		key: 'deployStatus',
		dataIndex: 'deployStatus',
		render: DeploymentStage,
	},
	{
		key: 'deployResult',
		title: '最后部署消息',
		dataIndex: 'deployResult',
		ellipsis: true,
	},
	{
		key: 'createdAt',
		title: '最后部署时间',
		dataIndex: 'createdAt',
		render: DeploymentTime,
	},
	{
		key: 'createdByName',
		title: '编辑者',
		dataIndex: 'createdByName',
	},
];

export const formValidationRules = [
	{
		required: true,
	},
];

export const iconStyle = { fontSize: '1.5rem' };
export const smallIconStyle = { fontSize: '1rem' };
export const holdIconStyle = { ...iconStyle, cursor: 'move' };

import { FormInstance } from 'antd';
import { Rule, RuleRender } from 'antd/es/form';
import { NamePath } from 'antd/es/form/interface';
import { ProcessorData } from 'types/api/pipeline/def';

type ProcessorType = {
	key: string;
	value: string;
	label: string;
	title?: string;
	disabled?: boolean;
};

export const processorTypes: Array<ProcessorType> = [
	{ key: 'grok_parser', value: 'grok_parser', label: '格罗克' },
	{ key: 'regex_parser', value: 'regex_parser', label: '正则表达式' },
	{ key: 'json_parser', value: 'json_parser', label: 'Json解析器' },
	{ key: 'trace_parser', value: 'trace_parser', label: '链路解析器' },
	{ key: 'time_parser', value: 'time_parser', label: '时间戳解析器' },
	{ key: 'severity_parser', value: 'severity_parser', label: '严重性解析器' },
	{ key: 'add', value: 'add', label: '添加' },
	{ key: 'remove', value: 'remove', label: '消除' },
	// { key: 'retain', value: 'retain', label: 'Retain' }, @Chintan - Commented as per Nitya's suggestion
	{ key: 'move', value: 'move', label: '移动' },
	{ key: 'copy', value: 'copy', label: '复制' },
];

export const DEFAULT_PROCESSOR_TYPE = processorTypes[0].value;

export type ProcessorFieldOption = {
	label: string;
	value: string;
};

// TODO(Raj): Refactor Processor Form code after putting e2e UI tests in place.
export type ProcessorFormField = {
	id: number;
	fieldName: string;
	placeholder: string;
	name: string | NamePath;
	rules?: Array<Rule>;
	hidden?: boolean;
	initialValue?: boolean | string | Array<string>;
	dependencies?: Array<string | NamePath>;
	options?: Array<ProcessorFieldOption>;
	shouldRender?: (form: FormInstance) => boolean;
	onFormValuesChanged?: (
		changedValues: ProcessorData,
		form: FormInstance,
	) => void;

	// Should this field have its own row or should it
	// be packed with other compact fields.
	compact?: boolean;
};

const traceParserFieldValidator: RuleRender = (form) => ({
	validator: (): Promise<void> => {
		const parseFromValues = [
			['trace_id', 'parse_from'],
			['span_id', 'parse_from'],
			['trace_flags', 'parse_from'],
		].map((np) => form.getFieldValue(np));

		if (!parseFromValues.some((v) => v?.length > 0)) {
			return Promise.reject(
				new Error('At least one of the trace parser fields must be specified.'),
			);
		}

		return Promise.resolve();
	},
});

const commonFields = [
	{
		id: 3,
		fieldName: 'Parse From',
		placeholder: 'processor_parsefrom_placeholder',
		name: 'parse_from', // optional
		rules: [],
		initialValue: 'body',
	},
	{
		id: 4,
		fieldName: 'Parse To',
		placeholder: 'processor_parseto_placeholder',
		name: 'parse_to', // optional
		rules: [],
		initialValue: 'attributes',
	},
	{
		id: 5,
		fieldName: 'On Error',
		placeholder: 'processor_onerror_placeholder',
		name: 'on_error', // optional
		rules: [],
		initialValue: 'send',
	},
];

export const processorFields: { [key: string]: Array<ProcessorFormField> } = {
	grok_parser: [
		{
			id: 1,
			fieldName: 'Name of Grok Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Pattern',
			placeholder: 'processor_pattern_placeholder',
			name: 'pattern',
		},
		...commonFields,
	],
	json_parser: [
		{
			id: 1,
			fieldName: 'Name of Json Parser Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Parse From',
			placeholder: 'processor_parsefrom_placeholder',
			name: 'parse_from',
			initialValue: 'body',
		},
		{
			id: 3,
			fieldName: 'Parse To',
			placeholder: 'processor_parseto_placeholder',
			name: 'parse_to',
			initialValue: 'attributes',
		},
	],
	regex_parser: [
		{
			id: 1,
			fieldName: 'Name of Regex Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Define Regex',
			placeholder: 'processor_regex_placeholder',
			name: 'regex',
		},
		...commonFields,
	],
	add: [
		{
			id: 1,
			fieldName: 'Name of Add Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Field',
			placeholder: 'processor_field_placeholder',
			name: 'field',
		},
		{
			id: 3,
			fieldName: 'Value',
			placeholder: 'processor_value_placeholder',
			name: 'value',
		},
	],
	remove: [
		{
			id: 1,
			fieldName: 'Name of Remove Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Field',
			placeholder: 'processor_field_placeholder',
			name: 'field',
		},
	],
	trace_parser: [
		{
			id: 1,
			fieldName: 'Name of Trace Parser Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Parse Trace Id From',
			placeholder: 'processor_trace_id_placeholder',
			name: ['trace_id', 'parse_from'],
			rules: [traceParserFieldValidator],
			dependencies: [
				['span_id', 'parse_from'],
				['trace_flags', 'parse_from'],
			],
		},
		{
			id: 3,
			fieldName: 'Parse Span Id From',
			placeholder: 'processor_span_id_placeholder',
			name: ['span_id', 'parse_from'],
			rules: [traceParserFieldValidator],
			dependencies: [
				['trace_id', 'parse_from'],
				['trace_flags', 'parse_from'],
			],
		},
		{
			id: 4,
			fieldName: 'Parse Trace flags From',
			placeholder: 'processor_trace_flags_placeholder',
			name: ['trace_flags', 'parse_from'],
			rules: [traceParserFieldValidator],
			dependencies: [
				['trace_id', 'parse_from'],
				['span_id', 'parse_from'],
			],
		},
	],
	time_parser: [
		{
			id: 1,
			fieldName: 'Name of Timestamp Parsing Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Parse Timestamp Value From',
			placeholder: 'processor_parsefrom_placeholder',
			name: 'parse_from',
			initialValue: 'attributes.timestamp',
		},
		{
			id: 3,
			fieldName: 'Timestamp Format Type',
			placeholder: '',
			name: 'layout_type',
			initialValue: 'strptime',
			options: [
				{
					label: 'Unix时代',
					value: 'epoch',
				},
				{
					label: 'strptime 格式',
					value: 'strptime',
				},
			],
			onFormValuesChanged: (
				changedValues: ProcessorData,
				form: FormInstance,
			): void => {
				if (changedValues?.layout_type) {
					const newLayoutValue =
						changedValues.layout_type === 'strptime' ? '%Y-%m-%dT%H:%M:%S.%f%z' : 's';

					form.setFieldValue('layout', newLayoutValue);
				}
			},
		},
		{
			id: 4,
			fieldName: 'Epoch Format',
			placeholder: '',
			name: 'layout',
			dependencies: ['layout_type'],
			shouldRender: (form: FormInstance): boolean => {
				const layoutType = form.getFieldValue('layout_type');
				return layoutType === 'epoch';
			},
			initialValue: 's',
			options: [
				{
					label: '秒',
					value: 's',
				},
				{
					label: '毫秒',
					value: 'ms',
				},
				{
					label: '微秒',
					value: 'us',
				},
				{
					label: '纳秒',
					value: 'ns',
				},
				{
					label: '秒.毫秒（例如：1136214245.123）',
					value: 's.ms',
				},
				{
					label: '秒.微秒（例如：1136214245.123456）',
					value: 's.us',
				},
				{
					label: '秒.纳秒（例如：1136214245.123456789）',
					value: 's.ns',
				},
			],
		},
		{
			id: 4,
			fieldName: 'Timestamp Format',
			placeholder: '基于 strptime 指令的格式。例如：%Y-%m-%dT%H:%M:%S.%f%z',
			name: 'layout',
			dependencies: ['layout_type'],
			shouldRender: (form: FormInstance): boolean => {
				const layoutType = form.getFieldValue('layout_type');
				return layoutType === 'strptime';
			},
			initialValue: '%Y-%m-%dT%H:%M:%S.%f%z',
		},
	],
	severity_parser: [
		{
			id: 1,
			fieldName: 'Name of Severity Parsing Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Parse Severity Value From',
			placeholder: 'processor_parsefrom_placeholder',
			name: 'parse_from',
			initialValue: 'attributes.logLevel',
		},
		{
			id: 3,
			fieldName: 'Values for level TRACE',
			placeholder: '指定逗号分隔值。例如：链路，0',
			name: ['mapping', 'trace'],
			rules: [],
			initialValue: ['trace'],
			compact: true,
		},
		{
			id: 4,
			fieldName: 'Values for level DEBUG',
			placeholder: '指定逗号分隔值。例如：调试，2xx',
			name: ['mapping', 'debug'],
			rules: [],
			initialValue: ['debug'],
			compact: true,
		},
		{
			id: 5,
			fieldName: 'Values for level INFO',
			placeholder: '指定逗号分隔值。例如：信息、3xx',
			name: ['mapping', 'info'],
			rules: [],
			initialValue: ['info'],
			compact: true,
		},
		{
			id: 6,
			fieldName: 'Values for level WARN',
			placeholder: '指定逗号分隔值。例如：警告、4xx',
			name: ['mapping', 'warn'],
			rules: [],
			initialValue: ['warn'],
			compact: true,
		},
		{
			id: 7,
			fieldName: 'Values for level ERROR',
			placeholder: '指定逗号分隔值。例如：错误，5xx',
			name: ['mapping', 'error'],
			rules: [],
			initialValue: ['error'],
			compact: true,
		},
		{
			id: 8,
			fieldName: 'Values for level FATAL',
			placeholder: '指定逗号分隔值。例如：致命、恐慌',
			name: ['mapping', 'fatal'],
			rules: [],
			initialValue: ['fatal'],
			compact: true,
		},
		{
			id: 9,
			fieldName: 'Override Severity Text',
			placeholder: '解析的严重性是否应该同时设置严重性和严重性文本？',
			name: ['overwrite_text'],
			rules: [],
			initialValue: true,
			hidden: true,
		},
	],
	retain: [
		{
			id: 1,
			fieldName: 'Name of Retain Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'Fields',
			placeholder: 'processor_fields_placeholder',
			name: 'fields',
		},
	],
	move: [
		{
			id: 1,
			fieldName: 'Name of Move Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'From',
			placeholder: 'processor_from_placeholder',
			name: 'from',
		},
		{
			id: 3,
			fieldName: 'To',
			placeholder: 'processor_to_placeholder',
			name: 'to',
		},
	],
	copy: [
		{
			id: 1,
			fieldName: 'Name of Copy Processor',
			placeholder: 'processor_name_placeholder',
			name: 'name',
		},
		{
			id: 2,
			fieldName: 'From',
			placeholder: 'processor_from_placeholder',
			name: 'from',
		},
		{
			id: 3,
			fieldName: 'To',
			placeholder: 'processor_to_placeholder',
			name: 'to',
		},
	],
};

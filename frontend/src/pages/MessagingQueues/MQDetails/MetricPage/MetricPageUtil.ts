/* eslint-disable sonarjs/no-duplicate-string */
import { PANEL_TYPES } from 'constants/queryBuilder';
import { GetWidgetQueryBuilderProps } from 'container/MetricsApplication/types';
import { Widgets } from 'types/api/dashboard/getAll';
import { DataTypes } from 'types/api/queryBuilder/queryAutocompleteResponse';
import { IBuilderQuery } from 'types/api/queryBuilder/queryBuilderData';
import { EQueryType } from 'types/common/dashboard';
import { DataSource } from 'types/common/queryBuilder';
import { v4 as uuid } from 'uuid';

interface GetWidgetQueryProps {
	title: string;
	description: string;
	queryData: IBuilderQuery[];
}

interface GetWidgetQueryPropsReturn extends GetWidgetQueryBuilderProps {
	description?: string;
	nullZeroValues: string;
}

export const getWidgetQueryBuilder = ({
	query,
	title = '',
	panelTypes,
	yAxisUnit = '',
	fillSpans = false,
	id,
	nullZeroValues,
	description,
}: GetWidgetQueryPropsReturn): Widgets => ({
	description: description || '',
	id: id || uuid(),
	isStacked: false,
	nullZeroValues: nullZeroValues || '',
	opacity: '1',
	panelTypes,
	query,
	timePreferance: 'GLOBAL_TIME',
	title,
	yAxisUnit,
	softMax: null,
	softMin: null,
	selectedLogFields: [],
	selectedTracesFields: [],
	fillSpans,
});

export function getWidgetQuery(
	props: GetWidgetQueryProps,
): GetWidgetQueryPropsReturn {
	const { title, description } = props;
	return {
		title,
		yAxisUnit: 'none',
		panelTypes: PANEL_TYPES.TIME_SERIES,
		fillSpans: false,
		description,
		nullZeroValues: 'zero',
		query: {
			queryType: EQueryType.QUERY_BUILDER,
			promql: [],
			builder: {
				queryData: props.queryData,
				queryFormulas: [],
			},
			clickhouse_sql: [],
			id: uuid(),
		},
	};
}

export const requestTimesWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_request_time_avg--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_request_time_avg',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Request Times',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '请求时间',
		description: '该指标用于测量 Kafka 代理上的请求所经历的平均延迟。',
	}),
);

export const brokerCountWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_brokers--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_brokers',
					type: 'Gauge',
				},
				aggregateOperator: 'sum',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Broker count',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'sum',
			},
		],
		title: '经纪商数量',
		description: 'Kafka 集群中的活动代理总数。',
	}),
);

export const producerFetchRequestPurgatoryWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_purgatory_size--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_purgatory_size',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Producer and Fetch Request Purgatory',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '生产者和获取请求炼狱',
		description: '衡量 Kafka 经纪商已收到但无法立即满足的请求数量',
	}),
);

export const brokerNetworkThroughputWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id:
						'kafka_server_brokertopicmetrics_bytesoutpersec_oneminuterate--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_server_brokertopicmetrics_bytesoutpersec_oneminuterate',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Broker Network Throughput',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '经纪商网络吞吐量',
		description:
			'帮助衡量从 Kafka 代理到消费者客户端的数据吞吐量，重点关注与向消费者提供消息相关的网络使用情况。',
	}),
);

export const ioWaitTimeWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_producer_io_waittime_total--float64--Sum--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_producer_io_waittime_total',
					type: 'Sum',
				},
				aggregateOperator: 'rate',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'I/O Wait Time',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'sum',
				stepInterval: 60,
				timeAggregation: 'rate',
			},
		],
		title: '输入/输出等待时间',
		description:
			'该指标测量生产者处于 I/O 等待状态的总时间，表明从生产者到 Kafka 代理的数据传输存在潜在瓶颈。',
	}),
);

export const requestResponseWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_producer_request_rate--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_producer_request_rate',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Request Rate',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_producer_response_rate--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_producer_response_rate',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'B',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Response Rate',
				limit: null,
				orderBy: [],
				queryName: 'B',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '请求和响应率',
		description:
			'指示生产者每秒发送的请求数，反映生产者与 Kafka 集群交互的强度。此外，还可以帮助 Kafka 管理员评估经纪人对生产者请求的响应能力。',
	}),
);

export const averageRequestLatencyWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_producer_request_latency_avg--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_producer_request_latency_avg',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Average Request Latency',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '平均请求延迟',
		description: '帮助 Kafka 管理员和开发人员了解生产者请求所经历的平均延迟。',
	}),
);

export const kafkaProducerByteRateWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_producer_byte_rate--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_producer_byte_rate',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'topic--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'topic',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: 'kafka_生产者_字节_率',
		description:
			'帮助测量生产者的数据输出率，指示生产者对 Kafka 代理施加的负载。',
	}),
);

export const bytesConsumedWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_consumer_bytes_consumed_rate--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_consumer_bytes_consumed_rate',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Bytes Consumed',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '消耗的字节数',
		description:
			'帮助 Kafka 管理员监控消费者组的数据消耗率，显示随着时间的推移从 Kafka 集群读取了多少数据（以字节为单位）。',
	}),
);

export const consumerOffsetWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_consumer_group_offset--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_consumer_group_offset',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'group--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'group',
						type: 'tag',
					},
					{
						dataType: DataTypes.String,
						id: 'topic--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'topic',
						type: 'tag',
					},
					{
						dataType: DataTypes.String,
						id: 'partition--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'partition',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '消费者抵消',
		description: '每个主题分区的每个消费者组的当前偏移量',
	}),
);

export const consumerGroupMemberWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_consumer_group_members--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_consumer_group_members',
					type: 'Gauge',
				},
				aggregateOperator: 'sum',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'group--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'group',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'sum',
				stepInterval: 60,
				timeAggregation: 'sum',
			},
		],
		title: '消费者团体成员',
		description: '每组活跃用户数',
	}),
);

export const consumerLagByGroupWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_consumer_group_lag--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_consumer_group_lag',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'group--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'group',
						type: 'tag',
					},
					{
						dataType: DataTypes.String,
						id: 'topic--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'topic',
						type: 'tag',
					},
					{
						dataType: DataTypes.String,
						id: 'partition--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'partition',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '按群体划分的消费者滞后',
		description: '帮助 Kafka 管理员评估消费者组是否跟上传入数据流或落后',
	}),
);

export const consumerFetchRateWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_consumer_fetch_rate--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_consumer_fetch_rate',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'service_name--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'service_name',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '消费者获取率',
		description:
			'指标衡量 Kafka 消费者向代理发出获取请求的速率，通常以每秒请求数为单位。',
	}),
);

export const messagesConsumedWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_consumer_records_consumed_rate--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_consumer_records_consumed_rate',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'Messages Consumed',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '消耗的消息',
		description: '测量 Kafka 消费者每秒消耗来自 Kafka 代理的记录（消息）的速率。',
	}),
);

export const jvmGCCountWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'jvm_gc_collections_count--float64--Sum--true',
					isColumn: true,
					isJSON: false,
					key: 'jvm_gc_collections_count',
					type: 'Sum',
				},
				aggregateOperator: 'rate',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'JVM GC Count',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'sum',
				stepInterval: 60,
				timeAggregation: 'rate',
			},
		],
		title: 'JVM GC 计数',
		description: '链路 Java 虚拟机 (JVM) 中发生的垃圾收集 (GC) 事件总数。',
	}),
);

export const jvmGcCollectionsElapsedWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'jvm_gc_collections_elapsed--float64--Sum--true',
					isColumn: true,
					isJSON: false,
					key: 'jvm_gc_collections_elapsed',
					type: 'Sum',
				},
				aggregateOperator: 'rate',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'garbagecollector',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'sum',
				stepInterval: 60,
				timeAggregation: 'rate',
			},
		],
		title: 'jvm_gc_collections_elapsed',
		description:
			'测量 Java 虚拟机 (JVM) 中垃圾收集 (GC) 事件所花费的总时间（通常以毫秒为单位）。',
	}),
);

export const cpuRecentUtilizationWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'jvm_cpu_recent_utilization--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'jvm_cpu_recent_utilization',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'CPU utilization',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: 'CPU 最近利用率',
		description:
			'该指标衡量 Java 虚拟机 (JVM) 最近的 CPU 使用情况，通常以百分比表示。',
	}),
);

export const jvmMemoryHeapWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'jvm_memory_heap_max--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'jvm_memory_heap_max',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [],
				having: [],
				legend: 'JVM memory heap',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: 'JVM 内存堆',
		description: '该指标表示 Java 虚拟机可用的最大堆内存量 (JVM)',
	}),
);

export const partitionCountPerTopicWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_topic_partitions--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_topic_partitions',
					type: 'Gauge',
				},
				aggregateOperator: 'sum',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'topic--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'topic',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'sum',
				stepInterval: 60,
				timeAggregation: 'sum',
			},
		],
		title: '每个主题的分区计数',
		description: '每个主题的分区数量',
	}),
);

export const currentOffsetPartitionWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_partition_current_offset--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_partition_current_offset',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'topic--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'topic',
						type: 'tag',
					},
					{
						dataType: DataTypes.String,
						id: 'partition--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'partition',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '当前偏移（分区）',
		description: '每个分区的当前偏移量，显示每个分区的最新位置',
	}),
);

export const oldestOffsetWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_partition_oldest_offset--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_partition_oldest_offset',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'topic--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'topic',
						type: 'tag',
					},
					{
						dataType: DataTypes.String,
						id: 'partition--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'partition',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '最旧的偏移量（分区）',
		description: '每个分区的最旧偏移量，用于标识日志保留和偏移量范围。',
	}),
);

export const insyncReplicasWidgetData = getWidgetQueryBuilder(
	getWidgetQuery({
		queryData: [
			{
				aggregateAttribute: {
					dataType: DataTypes.Float64,
					id: 'kafka_partition_replicas_in_sync--float64--Gauge--true',
					isColumn: true,
					isJSON: false,
					key: 'kafka_partition_replicas_in_sync',
					type: 'Gauge',
				},
				aggregateOperator: 'avg',
				dataSource: DataSource.METRICS,
				disabled: false,
				expression: 'A',
				filters: {
					items: [],
					op: 'AND',
				},
				functions: [],
				groupBy: [
					{
						dataType: DataTypes.String,
						id: 'topic--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'topic',
						type: 'tag',
					},
					{
						dataType: DataTypes.String,
						id: 'partition--string--tag--false',
						isColumn: false,
						isJSON: false,
						key: 'partition',
						type: 'tag',
					},
				],
				having: [],
				legend: '',
				limit: null,
				orderBy: [],
				queryName: 'A',
				reduceTo: 'avg',
				spaceAggregation: 'avg',
				stepInterval: 60,
				timeAggregation: 'avg',
			},
		],
		title: '同步副本 (ISR)',
		description: '每个分区的同步副本数量，以确保数据可用性。',
	}),
);

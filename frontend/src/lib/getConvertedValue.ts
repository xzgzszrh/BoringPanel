const unitsMapping = [
	{
		label: '数据',
		options: [
			{
				label: '字节（IEC）',
				value: 'bytes',
				factor: 1,
			},
			{
				label: '字节（SI）',
				value: 'decbytes',
				factor: 1,
			},
			{
				label: '位(IEC)',
				value: 'bits',
				factor: 8, // 1 byte = 8 bits
			},
			{
				label: '位(SI)',
				value: 'decbits',
				factor: 8, // 1 byte = 8 bits
			},
			{
				label: '千字节',
				value: 'kbytes',
				factor: 1024,
			},
			{
				label: '千字节',
				value: 'deckbytes',
				factor: 1000,
			},
			{
				label: '兆字节',
				value: 'mbytes',
				factor: 1024 * 1024,
			},
			{
				label: '兆字节',
				value: 'decmbytes',
				factor: 1000 * 1000,
			},
			{
				label: '千兆字节',
				value: 'gbytes',
				factor: 1024 * 1024 * 1024,
			},
			{
				label: '千兆字节',
				value: 'decgbytes',
				factor: 1000 * 1000 * 1000,
			},
			{
				label: '太字节',
				value: 'tbytes',
				factor: 1024 * 1024 * 1024 * 1024,
			},
			{
				label: '太字节',
				value: 'dectbytes',
				factor: 1000 * 1000 * 1000 * 1000,
			},
			{
				label: '皮字节',
				value: 'pbytes',
				factor: 1024 * 1024 * 1024 * 1024 * 1024,
			},
			{
				label: '拍字节',
				value: 'decpbytes',
				factor: 1000 * 1000 * 1000 * 1000 * 1000,
			},
		],
	},
	{
		label: '数据速率',
		options: [
			{
				label: '字节/秒(IEC)',
				value: 'binBps',
				factor: 1,
			},
			{
				label: '字节/秒(SI)',
				value: 'Bps',
				factor: 1,
			},
			{
				label: '比特/秒(IEC)',
				value: 'binbps',
				factor: 8, // 1 byte = 8 bits
			},
			{
				label: '比特/秒(SI)',
				value: 'bps',
				factor: 8, // 1 byte = 8 bits
			},
			{
				label: '千字节/秒',
				value: 'KiBs',
				factor: 1024,
			},
			{
				label: '千比特/秒',
				value: 'Kibits',
				factor: 8 * 1024, // 1 KiB = 8 Kibits
			},
			{
				label: '千字节/秒',
				value: 'KBs',
				factor: 1000,
			},
			{
				label: '千比特/秒',
				value: 'Kbits',
				factor: 8 * 1000, // 1 KB = 8 Kbits
			},
			{
				label: '兆字节/秒',
				value: 'MiBs',
				factor: 1024 * 1024,
			},
			{
				label: '兆比特/秒',
				value: 'Mibits',
				factor: 8 * 1024 * 1024, // 1 MiB = 8 Mibits
			},
			// ... (other options)
		],
	},
	{
		label: '时间',
		options: [
			{
				label: '纳秒 (ns)',
				value: 'ns',
				factor: 1,
			},
			{
				label: '微秒 (µs)',
				value: 'µs',
				factor: 1000, // 1 ms = 1000 µs
			},
			{
				label: '毫秒 (ms)',
				value: 'ms',
				factor: 1000 * 1000, // 1 s = 1000 ms
			},
			{
				label: '秒',
				value: 's',
				factor: 1000 * 1000 * 1000, // 1 s = 1000 ms
			},
			{
				label: '分钟（米）',
				value: 'm',
				factor: 60 * 1000 * 1000 * 1000, // 1 m = 60 s
			},
			{
				label: '小时 (h)',
				value: 'h',
				factor: 60 * 60 * 1000 * 1000 * 1000, // 1 h = 60 m
			},
			{
				label: '天 (d)',
				value: 'd',
				factor: 24 * 60 * 60 * 1000 * 1000 * 1000, // 1 d = 24 h
			},
		],
	},
	{
		label: '吞吐量',
		options: [
			{
				label: '计数/秒 (cps)',
				value: 'cps',
				factor: 1,
			},
			{
				label: '操作数/秒（操作数）',
				value: 'ops',
				factor: 1,
			},
			{
				label: '请求/秒 (reqps)',
				value: 'reqps',
				factor: 1,
			},
			{
				label: '每秒读取次数 (rps)',
				value: 'rps',
				factor: 1,
			},
			{
				label: '每秒写入 (wps)',
				value: 'wps',
				factor: 1,
			},
			{
				label: '每秒 I/O 操作数 (iops)',
				value: 'iops',
				factor: 1,
			},
			{
				label: '计数/分钟 (cpm)',
				value: 'cpm',
				factor: 60, // 1 cpm = 60 cps
			},
			{
				label: '操作次数/分钟 (opm)',
				value: 'opm',
				factor: 60, // 1 opm = 60 ops
			},
			{
				label: '读取次数/分钟 (rpm)',
				value: 'rpm',
				factor: 60, // 1 rpm = 60 rps
			},
			{
				label: '写入/分钟 (wpm)',
				value: 'wpm',
				factor: 60, // 1 wpm = 60 wps
			},
			// ... (other options)
		],
	},
	{
		label: '各种各样的',
		options: [
			{
				label: '百分比（0.0-1.0）',
				value: 'percentunit',
				factor: 100,
			},
			{
				label: '百分比（0 - 100）',
				value: 'percent',
				factor: 1,
			},
		],
	},
	{
		label: '布尔值',
		options: [
			{
				label: '正确/错误',
				value: 'bool',
				factor: 1,
			},
			{
				label: '是/否',
				value: 'bool_yes_no',
				factor: 1,
			},
		],
	},
];

function findUnitObject(
	unitValue: string,
): { label: string; value: string; factor: number } | null {
	const unitObj = unitsMapping
		.map((category) => category.options.find((unit) => unit.value === unitValue))
		.find(Boolean);

	return unitObj || null;
}

export function convertValue(
	value: number,
	currentUnit?: string,
	targetUnit?: string,
): number | null {
	if (
		targetUnit === 'none' ||
		!currentUnit ||
		!targetUnit ||
		currentUnit === targetUnit
	) {
		return value;
	}
	const currentUnitObj = findUnitObject(currentUnit);
	const targetUnitObj = findUnitObject(targetUnit);

	if (currentUnitObj && targetUnitObj) {
		const baseValue = value * currentUnitObj.factor;

		return baseValue / targetUnitObj.factor;
	}
	return null;
}

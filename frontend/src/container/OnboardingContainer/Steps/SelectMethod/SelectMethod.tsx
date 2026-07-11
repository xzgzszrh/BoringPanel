import { Radio, RadioChangeEvent, Space, Typography } from 'antd';
import {
	OnboardingMethods,
	useOnboardingContext,
} from 'container/OnboardingContainer/context/OnboardingContext';
import { useState } from 'react';

export default function SelectMethod(): JSX.Element {
	const { selectedMethod, updateSelectedMethod } = useOnboardingContext();
	const [value, setValue] = useState(selectedMethod);

	const onChange = (e: RadioChangeEvent): void => {
		setValue(e.target.value);
		updateSelectedMethod(e.target.value);
	};

	return (
		<div>
			<Radio.Group onChange={onChange} value={value}>
				<Space direction="vertical">
					<Radio value={OnboardingMethods.QUICK_START}>
						<Typography.Text> 快速入门 </Typography.Text> <br />
						<small>直接从 OpenTelemetry SDK 发送数据到 Scry。</small>
					</Radio>

					<Radio value={OnboardingMethods.RECOMMENDED_STEPS}>
						<Typography.Text> 使用推荐步骤 </Typography.Text> <br />
						<small>
							通过 OpenTelemetry Collector 将数据发送到 Scry（更好地控制发送到 Scry
							的数据，收集主机指标和日志）。
						</small>
					</Radio>
				</Space>
			</Radio.Group>
		</div>
	);
}

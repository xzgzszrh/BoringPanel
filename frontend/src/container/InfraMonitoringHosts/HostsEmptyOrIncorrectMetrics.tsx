import { Typography } from 'antd';

export default function HostsEmptyOrIncorrectMetrics({
	noData,
	incorrectData,
}: {
	noData: boolean;
	incorrectData: boolean;
}): JSX.Element {
	return (
		<div className="hosts-empty-state-container">
			<div className="hosts-empty-state-container-content">
				<img
					className="eyes-emoji"
					src="/Images/eyesEmoji.svg"
					alt="眼睛表情符号"
				/>

				{noData && (
					<div className="no-hosts-message">
						<Typography.Title level={5} className="no-hosts-message-title">
							尚未收到主机指标数据。
						</Typography.Title>

						<Typography.Text className="no-hosts-message-text">
							基础设施监控需要 OpenTelemetry 系统指标。
						</Typography.Text>
					</div>
				)}

				{incorrectData && (
					<Typography.Text className="incorrect-metrics-message">
						要查看主机指标，请升级到最新版本的 Scry k8s-infra 图表。
					</Typography.Text>
				)}
			</div>
		</div>
	);
}

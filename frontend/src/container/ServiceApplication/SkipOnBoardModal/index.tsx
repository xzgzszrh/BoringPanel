import { Button, Typography } from 'antd';
import Modal from 'components/Modal';

function SkipOnBoardingModal({ onContinueClick }: Props): JSX.Element {
	return (
		<Modal
			title="设置仪器"
			isModalVisible
			closable={false}
			footer={[
				<Button key="submit" type="primary" onClick={onContinueClick}>
					无需仪器即可继续
				</Button>,
			]}
		>
			<>
				<iframe
					width="100%"
					height="265"
					src="https://www.youtube.com/embed/J1Bof55DOb4"
					frameBorder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
					title="Youtube 视频"
				/>

				<div>
					<Typography>无仪器数据。</Typography>
					<Typography>请按上述方式检测您的应用程序</Typography>
				</div>
			</>
		</Modal>
	);
}

interface Props {
	onContinueClick: () => void;
}

export default SkipOnBoardingModal;

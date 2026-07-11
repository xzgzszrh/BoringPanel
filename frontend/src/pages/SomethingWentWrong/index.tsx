import { Button, Typography } from 'antd';
import SomethingWentWrongAsset from 'assets/SomethingWentWrong';
import { Container } from 'components/NotFound/styles';
import ROUTES from 'constants/routes';
import history from 'lib/history';

function SomethingWentWrong(): JSX.Element {
	return (
		<Container>
			<SomethingWentWrongAsset />
			<Typography.Title level={3}>哎呀！出了点问题</Typography.Title>
			<Button
				type="primary"
				onClick={(): void => {
					history.push(ROUTES.APPLICATION);
				}}
			>
				返回服务页面
			</Button>
		</Container>
	);
}

export default SomethingWentWrong;

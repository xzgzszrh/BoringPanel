import { Space, Typography } from 'antd';
import UnAuthorized from 'assets/UnAuthorized';
import { Button, Container } from 'components/NotFound/styles';
import ROUTES from 'constants/routes';

function UnAuthorizePage(): JSX.Element {
	return (
		<Container>
			<Space align="center" direction="vertical">
				<UnAuthorized />
				<Typography.Title level={3}>糟糕..您没有权限查看此页面</Typography.Title>
				<Button to={ROUTES.APPLICATION} tabIndex={0}>
					返回服务页面
				</Button>
			</Space>
		</Container>
	);
}

export default UnAuthorizePage;

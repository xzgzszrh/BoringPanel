import { Typography } from 'antd';

import { Container } from './styles';

function EmptyWidget(): JSX.Element {
	return (
		<Container>
			<Typography.Paragraph>
				单击上面的小部件类型之一（时间序列/值）以添加到此处
			</Typography.Paragraph>
		</Container>
	);
}

export default EmptyWidget;

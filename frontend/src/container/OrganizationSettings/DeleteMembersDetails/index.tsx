import { gold } from '@ant-design/colors';
import { ExclamationCircleTwoTone } from '@ant-design/icons';
import { Space, Typography } from 'antd';

function DeleteMembersDetails({
	name,
}: DeleteMembersDetailsProps): JSX.Element {
	return (
		<div>
			<Space direction="horizontal" size="middle" align="start">
				<ExclamationCircleTwoTone
					twoToneColor={[gold[6], '#1f1f1f']}
					style={{
						fontSize: '1.4rem',
					}}
				/>
				<Space direction="vertical">
					<Typography>您确定要删除吗 {name}</Typography>
					<Typography>这将删除 Scry 中仪表盘和其他功能的所有访问权限</Typography>
				</Space>
			</Space>
		</div>
	);
}

interface DeleteMembersDetailsProps {
	name: string;
}

export default DeleteMembersDetails;

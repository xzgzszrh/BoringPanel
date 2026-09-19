import { Button, Space } from 'antd';
import setFlags from 'api/user/setFlags';
import MessageTip from 'components/MessageTip';
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Dispatch } from 'redux';
import { AppState } from 'store/reducers';
import AppActions from 'types/actions';
import { UPDATE_USER_FLAG } from 'types/actions/app';
import { UserFlags } from 'types/api/user/setFlags';
import AppReducer from 'types/reducer/app';

import ReleaseNoteProps from '../ReleaseNoteProps';

export default function ReleaseNote0120({
	release,
}: ReleaseNoteProps): JSX.Element | null {
	const { user } = useSelector<AppState, AppReducer>((state) => state.app);

	const dispatch = useDispatch<Dispatch<AppActions>>();

	const handleDontShow = useCallback(async (): Promise<void> => {
		const flags: UserFlags = { ReleaseNote0120Hide: 'Y' };

		try {
			dispatch({
				type: UPDATE_USER_FLAG,
				payload: {
					flags,
				},
			});
			if (!user) {
				// no user is set, so escape the routine
				return;
			}

			const response = await setFlags({ userId: user?.userId, flags });

			if (response.statusCode !== 200) {
				console.log('failed to complete do not show status', response.error);
			}
		} catch (e) {
			// here we do not nothing as the cost of error is minor,
			// the user can switch the do no show option again in the further.
			console.log('unexpected error: failed to complete do not show status', e);
		}
	}, [dispatch, user]);

	return (
		<MessageTip
			show
			message={
				<div>
					您正在使用 {release} Scry。我们在 v0.12.0
					版本中引入了分布式设置。如果您在仪表盘或告警中使用或计划使用 clickhouse
					查询，您可能需要阅读有关查询新分布式表的信息{' '}
				</div>
			}
			action={
				<Space>
					<Button onClick={handleDontShow}>不再显示</Button>
				</Space>
			}
		/>
	);
}

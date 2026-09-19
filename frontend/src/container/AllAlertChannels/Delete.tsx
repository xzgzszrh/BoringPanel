import { Button } from 'antd';
import { NotificationInstance } from 'antd/es/notification/interface';
import deleteChannel from 'api/channels/delete';
import { Dispatch, SetStateAction, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Channels } from 'types/api/channels/getAll';

function Delete({ notifications, setChannels, id }: DeleteProps): JSX.Element {
	const { t } = useTranslation(['channels']);
	const [loading, setLoading] = useState(false);

	const onClickHandler = async (): Promise<void> => {
		try {
			setLoading(true);
			const response = await deleteChannel({
				id,
			});

			if (response.statusCode === 200) {
				notifications.success({
					message: '成功',
					description: t('channel_delete_success'),
				});
				setChannels((preChannels) => preChannels.filter((e) => e.id !== id));
			} else {
				notifications.error({
					message: '错误',
					description: response.error || t('channel_delete_unexp_error'),
				});
			}
			setLoading(false);
		} catch (error) {
			notifications.error({
				message: '错误',
				description:
					error instanceof Error
						? error.toString()
						: t('channel_delete_unexp_error'),
			});
			setLoading(false);
		}
	};

	return (
		<Button
			loading={loading}
			disabled={loading}
			type="link"
			onClick={onClickHandler}
		>
			删除
		</Button>
	);
}

interface DeleteProps {
	notifications: NotificationInstance;
	setChannels: Dispatch<SetStateAction<Channels[]>>;
	id: string;
}

export default Delete;

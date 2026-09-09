import { CopyOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space, Tooltip } from 'antd';
import getResetPasswordToken from 'api/user/getResetPasswordToken';
import ROUTES from 'constants/routes';
import { useNotifications } from 'hooks/useNotifications';
import {
	ChangeEventHandler,
	Dispatch,
	SetStateAction,
	useCallback,
	useEffect,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from 'react-use';
import { ROLES } from 'types/roles';

import { InputGroup, SelectDrawer, Title } from './styles';

const { Option } = Select;

function EditMembersDetails({
	emailAddress,
	name,
	role,
	setEmailAddress,
	setName,
	setRole,
	id,
}: EditMembersDetailsProps): JSX.Element {
	const [passwordLink, setPasswordLink] = useState<string>('');

	const { t } = useTranslation(['common']);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [state, copyToClipboard] = useCopyToClipboard();

	const getPasswordLink = (token: string): string =>
		`${window.location.origin}${ROUTES.PASSWORD_RESET}?token=${token}`;

	const onChangeHandler = useCallback(
		(setFunc: Dispatch<SetStateAction<string>>, value: string) => {
			setFunc(value);
		},
		[],
	);

	const { notifications } = useNotifications();

	useEffect(() => {
		if (state.error) {
			notifications.error({
				message: t('something_went_wrong'),
			});
		}

		if (state.value) {
			notifications.success({
				message: t('success'),
			});
		}
	}, [state.error, state.value, t, notifications]);

	const onPasswordChangeHandler: ChangeEventHandler<HTMLInputElement> = useCallback(
		(event) => {
			setPasswordLink(event.target.value);
		},
		[],
	);

	const onGeneratePasswordHandler = async (): Promise<void> => {
		try {
			setIsLoading(true);
			const response = await getResetPasswordToken({
				userId: id || '',
			});

			if (response.statusCode === 200) {
				setPasswordLink(getPasswordLink(response.payload.token));
			} else {
				notifications.error({
					message:
						response.error ||
						t('something_went_wrong', {
							ns: 'common',
						}),
				});
			}
			setIsLoading(false);
		} catch (error) {
			setIsLoading(false);

			notifications.error({
				message: t('something_went_wrong', {
					ns: 'common',
				}),
			});
		}
	};

	return (
		<Space direction="vertical" size="large">
			<Space direction="horizontal">
				<Title>电子邮件</Title>
				<Input
					placeholder="user@example.com"
					readOnly
					onChange={(event): void =>
						onChangeHandler(setEmailAddress, event.target.value)
					}
					disabled={isLoading}
					value={emailAddress}
				/>
			</Space>
			<Space direction="horizontal">
				<Title>姓名（可选）</Title>
				<Input
					placeholder="约翰"
					onChange={(event): void => onChangeHandler(setName, event.target.value)}
					value={name}
					disabled={isLoading}
				/>
			</Space>
			<Space direction="horizontal">
				<Title>角色</Title>
				<SelectDrawer
					value={role}
					onSelect={(value: unknown): void => {
						if (typeof value === 'string') {
							setRole(value as ROLES);
						}
					}}
					disabled={isLoading}
				>
					<Option value="ADMIN">行政</Option>
					<Option value="VIEWER">浏览器</Option>
					<Option value="EDITOR">编辑</Option>
				</SelectDrawer>
			</Space>

			<Button
				loading={isLoading}
				disabled={isLoading}
				onClick={onGeneratePasswordHandler}
				type="primary"
			>
				生成重置密码链接
			</Button>
			{passwordLink && (
				<InputGroup>
					<Input
						style={{ width: '100%' }}
						defaultValue="git@github.com:ant-design/ant-design.git"
						onChange={onPasswordChangeHandler}
						value={passwordLink}
						disabled={isLoading}
					/>
					<Tooltip title="复制链接">
						<Button
							icon={<CopyOutlined />}
							onClick={(): void => copyToClipboard(passwordLink)}
						/>
					</Tooltip>
				</InputGroup>
			)}
		</Space>
	);
}

interface EditMembersDetailsProps {
	emailAddress: string;
	name: string;
	role: ROLES;
	setEmailAddress: Dispatch<SetStateAction<string>>;
	setName: Dispatch<SetStateAction<string>>;
	setRole: Dispatch<SetStateAction<ROLES>>;
	id: string;
}

export default EditMembersDetails;

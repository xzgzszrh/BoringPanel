import './MySettings.styles.scss';

import { Button, Radio, RadioChangeEvent, Space, Typography } from 'antd';
import { Logout } from 'api/utils';
import useThemeMode, { useIsDarkMode } from 'hooks/useDarkMode';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import Password from './Password';
import TimezoneAdaptation from './TimezoneAdaptation/TimezoneAdaptation';
import UserInfo from './UserInfo';

function MySettings(): JSX.Element {
	const isDarkMode = useIsDarkMode();
	const { toggleTheme } = useThemeMode();

	const themeOptions = [
		{
			label: (
				<div className="theme-option">
					<Moon data-testid="dark-theme-icon" size={12} /> 深色
				</div>
			),
			value: 'dark',
		},
		{
			label: (
				<div className="theme-option">
					<Sun size={12} data-testid="light-theme-icon" /> 浅色
				</div>
			),
			value: 'light',
		},
	];

	const [theme, setTheme] = useState(isDarkMode ? 'dark' : 'light');

	const handleThemeChange = ({ target: { value } }: RadioChangeEvent): void => {
		setTheme(value);
		toggleTheme();
	};

	return (
		<Space
			direction="vertical"
			size="large"
			style={{
				margin: '16px 0',
			}}
		>
			<div className="theme-selector">
				<Typography.Title
					level={5}
					style={{
						margin: '0 0 16px 0',
					}}
				>
					{' '}
					主题{' '}
				</Typography.Title>
				<Radio.Group
					options={themeOptions}
					onChange={handleThemeChange}
					value={theme}
					optionType="button"
					buttonStyle="solid"
					data-testid="theme-selector"
				/>
			</div>

			<div className="user-info-container">
				<UserInfo />
			</div>

			<div className="password-reset-container">
				<Password />
			</div>

			<TimezoneAdaptation />

			<Button
				className="flexBtn"
				onClick={(): void => Logout()}
				type="primary"
				data-testid="logout-button"
			>
				<LogOut size={12} /> 退出登录
			</Button>
		</Space>
	);
}

export default MySettings;

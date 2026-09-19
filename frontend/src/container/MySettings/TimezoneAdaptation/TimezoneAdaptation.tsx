import './TimezoneAdaptation.styles.scss';

import { Color } from '@signozhq/design-tokens';
import { Switch } from 'antd';
import { Delete } from 'lucide-react';
import { useTimezone } from 'providers/Timezone';
import { useMemo } from 'react';

function TimezoneAdaptation(): JSX.Element {
	const {
		timezone,
		browserTimezone,
		updateTimezone,
		isAdaptationEnabled,
		setIsAdaptationEnabled,
	} = useTimezone();

	const isTimezoneOverridden = useMemo(
		() => timezone.offset !== browserTimezone.offset,
		[timezone, browserTimezone],
	);

	const getSwitchStyles = (): React.CSSProperties => ({
		backgroundColor:
			isAdaptationEnabled && isTimezoneOverridden ? Color.BG_AMBER_400 : undefined,
	});

	const handleOverrideClear = (): void => {
		updateTimezone(browserTimezone);
	};

	return (
		<div className="timezone-adaption">
			<div className="timezone-adaption__header">
				<h2 className="timezone-adaption__title">适应我的时区</h2>
				<Switch
					checked={isAdaptationEnabled}
					onChange={setIsAdaptationEnabled}
					style={getSwitchStyles()}
				/>
			</div>

			<p className="timezone-adaption__description">
				将 Scry 控制台中显示的时间戳调整为我的活动时区。
			</p>

			<div className="timezone-adaption__note">
				<div className="timezone-adaption__note-text-container">
					<span className="timezone-adaption__bullet">•</span>
					<span className="timezone-adaption__note-text">
						{isTimezoneOverridden ? (
							<>
								您当前的时区被覆盖为
								<span className="timezone-adaption__note-text-overridden">
									{timezone.offset}
								</span>
							</>
						) : (
							<>您可以使用时间选择器覆盖任何视图的时区适应。</>
						)}
					</span>
				</div>

				{!!isTimezoneOverridden && (
					<button
						type="button"
						className="timezone-adaption__clear-override"
						onClick={handleOverrideClear}
					>
						<Delete height={12} width={12} color={Color.BG_ROBIN_300} />
						清除覆盖
					</button>
				)}
			</div>
		</div>
	);
}

export default TimezoneAdaptation;

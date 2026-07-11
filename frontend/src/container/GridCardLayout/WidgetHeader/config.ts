import { themeColors } from 'constants/theme';
import { limit } from 'lib/getChartData';
import { CSSProperties } from 'react';

const positionCss: CSSProperties['position'] = 'absolute';

export const spinnerStyles = {
	position: positionCss,
	top: '0',
	right: '0',
};
export const tooltipStyles = {
	fontSize: '1rem',
	top: '0.313rem',
	position: positionCss,
	right: '0.313rem',
	color: themeColors.errorColor,
};

export const errorTooltipPosition = 'top';

export const overlayStyles: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	justifyContent: 'center',
	position: 'absolute',
};

export const WARNING_MESSAGE = `结果中的时间序列过多，界面仅显示前 ${limit} 条。请检查查询条件。`;

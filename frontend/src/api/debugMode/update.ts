import axios from 'api';
import { ApiResponse } from 'types/api';
import { DebugModeConfig, DebugModeStatus } from 'types/api/debugMode';

const updateDebugMode = async (
	config: DebugModeConfig,
): Promise<DebugModeStatus> => {
	const response = await axios.put<ApiResponse<DebugModeStatus>>(
		'/debug-mode',
		config,
	);
	return response.data.data;
};

export default updateDebugMode;

import axios from 'api';
import { ApiResponse } from 'types/api';
import { DebugModeStatus } from 'types/api/debugMode';

const cleanupDebugData = async (): Promise<DebugModeStatus> => {
	const response = await axios.post<ApiResponse<DebugModeStatus>>(
		'/debug-mode/cleanup',
	);
	return response.data.data;
};

export default cleanupDebugData;

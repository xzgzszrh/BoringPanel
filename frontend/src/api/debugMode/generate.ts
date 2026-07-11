import axios from 'api';
import { ApiResponse } from 'types/api';
import { DebugModeStatus } from 'types/api/debugMode';

const generateDebugData = async (): Promise<DebugModeStatus> => {
	const response = await axios.post<ApiResponse<DebugModeStatus>>(
		'/debug-mode/generate',
	);
	return response.data.data;
};

export default generateDebugData;

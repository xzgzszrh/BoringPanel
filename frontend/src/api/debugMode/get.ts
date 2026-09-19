import axios from 'api';
import { ApiResponse } from 'types/api';
import { DebugModeStatus } from 'types/api/debugMode';

const getDebugMode = async (): Promise<DebugModeStatus> => {
	const response = await axios.get<ApiResponse<DebugModeStatus>>('/debug-mode');
	return response.data.data;
};

export default getDebugMode;

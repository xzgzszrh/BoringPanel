import axios from 'api';
import { ApiResponse } from 'types/api';
import { DebugScenarioCatalogItem } from 'types/api/debugMode';

const getDebugScenarios = async (): Promise<DebugScenarioCatalogItem[]> => {
	const response = await axios.get<ApiResponse<DebugScenarioCatalogItem[]>>(
		'/debug-mode/scenarios',
	);
	return response.data.data;
};

export default getDebugScenarios;

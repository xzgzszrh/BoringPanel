import { RouteTabProps } from 'components/RouteTab/types';
import { TFunction } from 'i18next';
import { ROLES, USER_ROLES } from 'types/roles';
import { isCloudUser, isEECloudUser } from 'utils/app';

import {
	agentSettings,
	alertChannels,
	apiKeys,
	debugModeSettings,
	generalSettings,
	ingestionSettings,
	multiIngestionSettings,
	organizationSettings,
} from './config';

export const getRoutes = (
	userRole: ROLES | null,
	isCurrentOrgSettings: boolean,
	isGatewayEnabled: boolean,
	t: TFunction,
): RouteTabProps['routes'] => {
	const settings = [];

	settings.push(...generalSettings(t));

	if (isCurrentOrgSettings) {
		settings.push(...organizationSettings(t));
	}

	if (
		isGatewayEnabled &&
		(userRole === USER_ROLES.ADMIN || userRole === USER_ROLES.EDITOR)
	) {
		settings.push(...multiIngestionSettings(t));
	}

	if (isCloudUser() && !isGatewayEnabled) {
		settings.push(...ingestionSettings(t));
	}

	settings.push(...alertChannels(t));

	if (userRole === USER_ROLES.ADMIN) {
		settings.push(...agentSettings());
		settings.push(...debugModeSettings());
	}

	if ((isCloudUser() || isEECloudUser()) && userRole === USER_ROLES.ADMIN) {
		settings.push(...apiKeys(t));
	}

	return settings;
};

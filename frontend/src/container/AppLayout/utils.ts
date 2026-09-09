import ROUTES from 'constants/routes';
import { matchPath } from 'react-router-dom';

export function getRouteKey(pathname: string): string {
	if (pathname.startsWith(`${ROUTES.AI_LOOPS}/`)) return 'AI_LOOPS';
	const [routeKey] = Object.entries(ROUTES).find(([, route]) =>
		matchPath(pathname, { path: route, exact: true }),
	) || ['DEFAULT'];

	return routeKey;
}

import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

import cacheBursting from '../../i18n-translations-hash.json';

i18n
	// load translation using http -> see /public/locales
	.use(Backend)
	// pass the i18n instance to react-i18next.
	.use(initReactI18next)
	// init i18next
	.init({
		debug: false,
		lng: 'zh-CN',
		fallbackLng: 'zh-CN',
		supportedLngs: ['zh-CN'],
		load: 'currentOnly',
		interpolation: {
			escapeValue: false, // not needed for react as it escapes by default
		},
		backend: {
			loadPath: (_language, namespace) => {
				const ns = namespace[0];
				const pathkey = `/zh-CN/${ns}`;
				const hash = cacheBursting[pathkey as keyof typeof cacheBursting] || '';
				return `/locales/zh-CN/${namespace}.json?h=${hash}`;
			},
		},
		react: {
			useSuspense: false,
		},
	});

export default i18n;

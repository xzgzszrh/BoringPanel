import './OnboardingFooter.styles.scss';

import { Dot } from 'lucide-react';

export function OnboardingFooter(): JSX.Element {
	return (
		<section className="footer-main-container">
			<div className="footer-container">
				<Dot size={24} color="#2C3140" />
			</div>
		</section>
	);
}

import './OnboardingHeader.styles.scss';

export function OnboardingHeader(): JSX.Element {
	return (
		<div className="header-container">
			<div className="logo-container">
				<img src="/Logos/scry-brand-logo.svg" alt="Scry" />
				<span className="logo-text">Scry</span>
			</div>
		</div>
	);
}

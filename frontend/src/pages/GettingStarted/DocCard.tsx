import { TGetStartedContentDoc } from './types';

interface IDocCardProps {
	text: TGetStartedContentDoc['title'];
	icon: TGetStartedContentDoc['icon'];
	url: TGetStartedContentDoc['url'];
}
function DocCard(_props: IDocCardProps): JSX.Element | null {
	return null;
}

export default DocCard;

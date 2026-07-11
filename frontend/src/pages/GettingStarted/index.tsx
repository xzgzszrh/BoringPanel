import { Typography } from 'antd';

import { GetStartedContent } from './renderConfig';
import DocSection from './Section';

function InstrumentationPage(): JSX.Element {
	return (
		<>
			<Typography>
				恭喜您已经成功安装Scry！现在让我们输入一些数据并开始从中获取见解
			</Typography>
			{GetStartedContent().map((section) => (
				<DocSection key={section.heading} sectionData={section} />
			))}
		</>
	);
}

export default InstrumentationPage;

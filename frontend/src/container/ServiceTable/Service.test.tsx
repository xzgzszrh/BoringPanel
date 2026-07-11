import { render, screen, waitFor } from 'tests/test-utils';

import { Services } from './__mock__/servicesListMock';
import Metrics from './index';

describe('Metrics Component', () => {
	it('renders without errors', async () => {
		render(<Metrics services={Services} isLoading={false} />);

		await waitFor(() => {
			expect(screen.getByText('应用')).toBeInTheDocument();
			expect(screen.getByText('P99 延迟（毫秒）')).toBeInTheDocument();
			expect(screen.getByText('错误率（占总量百分比）')).toBeInTheDocument();
			expect(screen.getByText('每秒操作数')).toBeInTheDocument();
		});
	});

	it('renders if the data is loaded in the table', async () => {
		render(<Metrics services={Services} isLoading={false} />);

		expect(screen.getByText('frontend')).toBeInTheDocument();
	});

	it('renders no data when required conditions are met', async () => {
		render(<Metrics services={[]} isLoading={false} />);

		expect(screen.getByText('No data')).toBeInTheDocument();
	});
});

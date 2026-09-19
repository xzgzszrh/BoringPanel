import { act, fireEvent, render, screen } from 'tests/test-utils';

import ServiceTraces from '.';

describe('ServicesTraces', () => {
	test('Should render the component', async () => {
		await act(() => {
			render(<ServiceTraces />);
		});
		const applicationHeader = screen.getByText('应用');
		expect(applicationHeader).toBeInTheDocument();
		const p99LatencyHeader = screen.getByText('P99 延迟（毫秒）');
		expect(p99LatencyHeader).toBeInTheDocument();
		const errorRateHeader = screen.getByText('错误率（占总量百分比）');
		expect(errorRateHeader).toBeInTheDocument();
	});

	test('Should render the Services with Services', async () => {
		act(() => {
			render(<ServiceTraces />);
		});
		const servierName = await screen.findByText(/TestService/i, {
			exact: true,
		});
		expect(servierName).toBeInTheDocument();
		const p99Latency = await screen.findByText(/8\.11/i);
		expect(p99Latency).toBeInTheDocument();
	});

	test('Should click on p99 latency and sort the table', async () => {
		act(() => {
			render(<ServiceTraces />);
		});
		const p99LatencyHeader = await screen.findByText('P99 延迟（毫秒）');
		expect(p99LatencyHeader).toBeInTheDocument();
		const firstServiceName = await screen.findByText(/TestService/i);
		expect(firstServiceName).toBeInTheDocument();
		const secondServiceName = await screen.findByText(/TestCustomerService/i);
		expect(secondServiceName).toBeInTheDocument();
		const allRow = screen.getAllByRole('row');
		expect(allRow).toHaveLength(3);
		expect(allRow[1].innerHTML).toContain('TestService');
		expect(allRow[2].innerHTML).toContain('TestCustomerService');

		const tableHeader = await screen.findAllByRole('columnheader');
		expect(tableHeader).toHaveLength(4);

		fireEvent.click(tableHeader[1]);

		const allSortedRowAsc = screen.getAllByRole('row');
		expect(allSortedRowAsc).toHaveLength(3);
		expect(allSortedRowAsc[1].innerHTML).toContain('TestService');

		fireEvent.click(tableHeader[1]);
		const allSortedRowDsc = screen.getAllByRole('row');
		expect(allSortedRowDsc).toHaveLength(3);
		expect(allSortedRowDsc[1].innerHTML).toContain('TestCustomerService');
	});
});

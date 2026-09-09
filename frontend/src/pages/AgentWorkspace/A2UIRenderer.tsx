import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface A2UIRendererProps {
	surface: Record<string, unknown>;
}

interface A2UIStep {
	id?: string;
	title: string;
	description?: string;
	status?: string;
}

interface A2UIRoot {
	type?: string;
	title?: string;
	data?: unknown;
}

function rowsFromData(data: unknown): Record<string, unknown>[] {
	if (Array.isArray(data)) return data;
	if (!data || typeof data !== 'object') return [];
	const record = data as Record<string, unknown>;
	if (Array.isArray(record.data)) return record.data;
	if (Array.isArray(record.items)) return record.items;
	if (Array.isArray(record.results)) return record.results;
	return [];
}

function stepIcon(status: string): JSX.Element {
	if (status === 'completed') return <CheckCircle2 size={16} />;
	if (status === 'running') return <Loader2 className="agent-spin" size={16} />;
	return <Circle size={16} />;
}

export default function A2UIRenderer({
	surface,
}: A2UIRendererProps): JSX.Element {
	const root = (surface.root || {}) as A2UIRoot;
	if (root.type === 'plan') {
		const steps: A2UIStep[] =
			root.data && typeof root.data === 'object' && 'steps' in root.data
				? (((root.data as { steps?: A2UIStep[] }).steps || []) as A2UIStep[])
				: [];
		return (
			<div className="agent-a2ui agent-plan">
				<div className="agent-a2ui-title">{root.title}</div>
				{steps.map((step) => (
					<div className="agent-plan-step" key={step.id || step.title}>
						{stepIcon(step.status || 'pending')}
						<div>
							<strong>{step.title}</strong>
							{step.description && <span>{step.description}</span>}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (root.type === 'table') {
		const rows = rowsFromData(root.data).slice(0, 20);
		const columns = rows.length ? Object.keys(rows[0]).slice(0, 6) : [];
		return (
			<div className="agent-a2ui">
				<div className="agent-a2ui-title">{root.title}</div>
				{rows.length ? (
					<div className="agent-a2ui-table-wrap">
						<table>
							<thead>
								<tr>
									{columns.map((column) => (
										<th key={column}>{column}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={String(row.id || row.name || JSON.stringify(row))}>
										{columns.map((column) => (
											<td key={column}>
												{typeof row[column] === 'object'
													? JSON.stringify(row[column])
													: String(row[column] ?? '')}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<pre>{JSON.stringify(root.data, null, 2)}</pre>
				)}
			</div>
		);
	}

	return (
		<div className="agent-a2ui">
			<div className="agent-a2ui-title">{root.title || '工具结果'}</div>
			<pre>{JSON.stringify(root.data, null, 2)}</pre>
		</div>
	);
}

import { Form, Input, Select } from 'antd';
import { LabelFilterStatement } from 'container/CreateAlertChannels/config';
import { Dispatch, SetStateAction } from 'react';

const { Option } = Select;

// LabelFilterForm supports filters or matchers on alert notifications
// presently un-used but will be introduced to the channel creation at some
// point
function LabelFilterForm({ setFilter }: LabelFilterProps): JSX.Element {
	return (
		<Form.Item name="label_filter" label="Notify When (Optional)">
			<Input.Group compact>
				<Select
					defaultValue="Severity"
					style={{ width: '15%' }}
					onChange={(event): void => {
						setFilter((value) => {
							const first: LabelFilterStatement = value[0] as LabelFilterStatement;
							first.name = event;
							return [first];
						});
					}}
				>
					<Option value="severity">严重性</Option>
					<Option value="service">服务</Option>
				</Select>
				<Select
					defaultValue="="
					onChange={(event): void => {
						setFilter((value) => {
							const first: LabelFilterStatement = value[0] as LabelFilterStatement;
							first.comparator = event;
							return [first];
						});
					}}
				>
					<Option value="=">=</Option>
					<Option value="!=">!=</Option>
				</Select>
				<Input
					style={{ width: '20%' }}
					placeholder="在此输入文字"
					onChange={(event): void => {
						setFilter((value) => {
							const first: LabelFilterStatement = value[0] as LabelFilterStatement;
							first.value = event.target.value;
							return [first];
						});
					}}
				/>
			</Input.Group>
		</Form.Item>
	);
}

export interface LabelFilterProps {
	setFilter: Dispatch<SetStateAction<Partial<Array<LabelFilterStatement>>>>;
}

export default LabelFilterForm;

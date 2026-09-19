import AllErrorsContainer from 'container/AllError';
import ResourceAttributesFilter from 'container/ResourceAttributesFilter';

function AllErrors(): JSX.Element {
	return (
		<>
			<ResourceAttributesFilter />
			<AllErrorsContainer />
		</>
	);
}

export default AllErrors;

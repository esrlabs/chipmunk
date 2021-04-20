import { SearchDataAccessor } from './accessor.search';
import { Provider } from './provider';

export class SearchDataProvider extends Provider {

    constructor(
        session: string,
        accessor: SearchDataAccessor,
    ) {
        super(session, accessor);
    }

    public getName(): string {
        return `Search`;
    }


}

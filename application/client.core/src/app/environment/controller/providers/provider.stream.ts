import { StreamDataAccessor } from './accessor.stream';
import { Provider } from './provider';

export class StreamDataProvider extends Provider {

    constructor(
        session: string,
        accessor: StreamDataAccessor,
    ) {
        super(session, accessor);
    }

    public getName(): string {
        return `Stream`;
    }


}

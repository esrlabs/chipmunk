import { RustSession } from '../../native/native.session';
import { ICancelablePromise } from 'platform/env/promise';
import { EventProvider } from '../../api/session.provider';
import { IFilter, TExtractedValues } from '../../interfaces/index';
import { Executors } from './session.stream.executors';
import { TaskManager } from './single.task';
import { scope } from 'platform/env/scope';

export class ExtractTaskManager extends TaskManager<IFilter[], TExtractedValues> {
    protected readonly provider: EventProvider;
    protected readonly session: RustSession;

    constructor(provider: EventProvider, session: RustSession, uuid: string) {
        super(scope.getLogger(`ExtractTaskManager: ${uuid}`));
        this.provider = provider;
        this.session = session;
    }

    executor(filters: IFilter[]): ICancelablePromise<TExtractedValues> {
        return Executors.extract(this.session, this.provider, this.logger, filters);
    }
}

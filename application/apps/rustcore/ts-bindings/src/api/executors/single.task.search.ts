import * as Logs from '../../util/logging';

import { RustSession } from '../../native/native.session';
import { ICancelablePromise } from 'platform/env/promise';
import { EventProvider } from '../../api/session.provider';
import { IFilter } from '../../interfaces/index';
import { Executors } from './session.stream.executors';
import { TaskManager } from './single.task';

export class SearchTaskManager extends TaskManager<IFilter[], number> {
    protected readonly provider: EventProvider;
    protected readonly session: RustSession;

    constructor(provider: EventProvider, session: RustSession, uuid: string) {
        super(Logs.getLogger(`SearchTaskManager: ${uuid}`));
        this.provider = provider;
        this.session = session;
    }

    executor(filters: IFilter[]): ICancelablePromise<number> {
        return Executors.search(this.session, this.provider, this.logger, filters);
    }
}

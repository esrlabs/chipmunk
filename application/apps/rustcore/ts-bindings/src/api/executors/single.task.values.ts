import * as Logs from '../../util/logging';

import { RustSession } from '../../native/native.session';
import { ICancelablePromise } from 'platform/env/promise';
import { EventProvider } from '../session.provider';
import { Executors } from './session.stream.executors';
import { TaskManager } from './single.task';
import { SearchValuesResult } from 'platform/types/filter';

export class ValuesTaskManager extends TaskManager<string[], SearchValuesResult> {
    protected readonly provider: EventProvider;
    protected readonly session: RustSession;

    constructor(provider: EventProvider, session: RustSession, uuid: string) {
        super(Logs.getLogger(`ValuesTaskManager: ${uuid}`));
        this.provider = provider;
        this.session = session;
    }

    executor(filters: string[]): ICancelablePromise<SearchValuesResult> {
        return Executors.values(this.session, this.provider, this.logger, filters);
    }
}

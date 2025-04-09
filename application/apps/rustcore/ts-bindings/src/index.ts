import { v4 } from 'uuid';
import { setUuidGenerator } from 'platform/env/sequence';

import * as Units from './util/units';
import * as Interfaces from './interfaces/index';
import * as Events from 'platform/env/subscription';

export { CancelablePromise, PromiseExecutor, ICancelablePromise } from 'platform/env/promise';
export {
    TFileOptions,
    IFileOptionsDLT,
    EFileOptionsRequirements,
} from './api/executors/session.stream.observe.executor';
export {
    Session,
    SessionSearch,
    SessionStream,
    ISessionEvents,
    IProgressEvent,
    IProgressState,
    IEventMapUpdated,
    IEventMatchesUpdated,
    IEventIndexedMapUpdated,
} from './api/session';
export { Jobs } from './api/jobs';
export { Tracker } from './api/tracker';
export { Components } from './api/components';
export { Units, Events, Interfaces };

export * as $ from 'platform/types/observe';

setUuidGenerator(v4);

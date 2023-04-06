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
    Observe,
    SessionSearch,
    SessionStream,
    ISessionEvents,
    IProgressEvent,
    IProgressState,
    IEventMapUpdated,
    IEventMatchesUpdated,
    IEventIndexedMapUpdated,
    ISearchValuesUpdated,
} from './api/session';

export { Jobs } from './api/jobs';
export { Tracker } from './api/tracker';

export {
    IGrabbedElement,
    IExtractDTFormatOptions,
    IExtractDTFormatResult,
    IResultSearchElement,
    IMapEntity,
    IMatchEntity,
    IFilter,
    IFilterFlags,
    IGrabbedContent,
} from './interfaces/index';

export { Units, Events, Interfaces };

setUuidGenerator(v4);

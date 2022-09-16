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
} from './api/session';

export { IExportOptions, IDetectDTFormatResult, IDetectOptions } from './api/session.stream';

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

export * as dlt from './native/native.dlt';
export * as tools from './native/native.tools';
export * as serial from './native/native.serial';

export { Units, Events, Interfaces };

setUuidGenerator(v4);

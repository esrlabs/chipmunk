import { Computation } from './сomputation';
import { RustAppendOperationChannel } from '../native/index';
import {
    IEventsInterfaces,
    EventsInterfaces,
    EventsSignatures,
    IEventsSignatures,
    IEvents,
    IOperationProgress,
    IError,
} from '../interfaces/computation.minimal.withprogress';

import * as Events from '../util/events';

export class StreamAppendComputation extends Computation<IEvents> {
    private readonly _events: IEvents = {
        progress: new Events.Subject<IOperationProgress>(),
        error: new Events.Subject<IError>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(uuid: string) {
        super(uuid);
    }

    public getName(): string {
        return 'StreamAppendComputation';
    }

    public getEvents(): IEvents {
        return this._events;
    }

    public getEventsSignatures(): IEventsSignatures {
        return EventsSignatures;
    }

    public getEventsInterfaces(): IEventsInterfaces {
        return EventsInterfaces;
    }
}

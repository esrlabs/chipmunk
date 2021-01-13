import { Computation } from '../provider/provider';
import {
    IEventsInterfaces,
    EventsInterfaces,
    EventsSignatures,
    IEventsSignatures,
    IEvents,
    IOperationProgress,
} from '../provider/provider.minimal.withprogress';
import { IProviderError } from '../provider/provider.errors';

import * as Events from '../util/events';

export interface IExportOptions {
    from: number;
    to: number;
    destFilename: string;
    keepFormat: boolean;
}

export class StreamExportComputation extends Computation<IEvents> {
    private readonly _events: IEvents = {
        progress: new Events.Subject<IOperationProgress>(),
        error: new Events.Subject<IProviderError>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(uuid: string) {
        super(uuid);
    }

    public getName(): string {
        return 'StreamExportComputation';
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

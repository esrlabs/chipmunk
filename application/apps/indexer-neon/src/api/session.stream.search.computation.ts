import { Computation } from './сomputation';
import { RustSearchOperationChannel } from '../native/index';
import { IMatchEntity } from '../interfaces/index';

import * as Events from '../util/events';

export interface IEvents {
    matches: Events.Subject<IMatchEntity[]>,
    error: Events.Subject<Error>,
    destroyed: Events.Subject<void>,
}

interface IEventsSignatures {
    matches: 'matches';
    error: 'error';
    destroyed: 'destroyed';
};

const EventsInterface = {
    matches: { self: 'object', matches: Array },
    error: { self: Error },
    destroyed: { self: null },
};

export class StreamSearchComputation extends Computation<IEvents> {

    private readonly _events: IEvents = {
        matches: new Events.Subject<IMatchEntity[]>(),
        error: new Events.Subject<Error>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(channel: RustSearchOperationChannel, uuid: string) {
        super(channel, uuid);
    }

    public getName(): string {
        return 'StreamSearchComputation';
    }

    public getEvents(): IEvents {
        return this._events;
    }

    public getEventsSignatures(): IEventsSignatures {
        return {
            matches: 'matches',
            error: 'error',
            destroyed: 'destroyed',
        };
    }

    public getEventsInterfaces() {
        return EventsInterface;
    }


}

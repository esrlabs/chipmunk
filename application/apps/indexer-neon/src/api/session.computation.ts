import { Computation } from './сomputation';
import { RustSessionChannel } from '../native/index';

import * as Events from '../util/events';

export interface IEventStreamUpdated {
    rows: number;
}

export interface IEventSearchUpdated {
    rows: number;
}

export interface ISessionEvents {
    streamUpdated: Events.Subject<IEventStreamUpdated>,
    searchUpdated: Events.Subject<IEventSearchUpdated>,
    error: Events.Subject<Error>,
    destroyed: Events.Subject<void>,
    done: Events.Subject<void>,
}

interface ISessionEventsSignatures {
    streamUpdated: 'streamUpdated';
    searchUpdated: 'searchUpdated';
    error: 'error';
    destroyed: 'destroyed';
    done: 'done';
};

const SessionEventsInterface = {
    streamUpdated: { self: 'object', rows: 'number' },
    searchUpdated: { self: 'object', rows: 'number' },
    error: { self: Error },
    destroyed: { self: null },
    done: { self: null }
};

export class SessionComputation extends Computation<ISessionEvents> {

    private readonly _events: ISessionEvents = {
        streamUpdated: new Events.Subject<IEventStreamUpdated>(),
        searchUpdated: new Events.Subject<IEventSearchUpdated>(),
        error: new Events.Subject<Error>(),
        destroyed: new Events.Subject<void>(),
        done: new Events.Subject<void>(),
    };

    constructor(channel: RustSessionChannel, uuid: string) {
        super(channel, uuid);
    }

    public getName(): string {
        return 'SessionComputation';
    }

    public getEvents(): ISessionEvents {
        return this._events;
    }

    public getEventsSignatures(): ISessionEventsSignatures {
        return {
            streamUpdated: 'streamUpdated',
            searchUpdated: 'searchUpdated',
            error: 'error',
            destroyed: 'destroyed',
            done: 'done',
        };
    }

    public getEventsInterfaces() {
        return SessionEventsInterface;
    }


}

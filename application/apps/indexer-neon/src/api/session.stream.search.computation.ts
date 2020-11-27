import { Computation } from './сomputation';
import { IMatchEntity } from '../interfaces/index';
import {
    IEventsInterfaces,
    EventsInterfaces,
    EventsSignatures,
    IEventsSignatures,
    IEvents,
    IOperationProgress,
} from '../interfaces/computation.minimal.withprogress';
import { IComputationError } from '../interfaces/errors';

import * as Events from '../util/events';

export interface ISearchEvents extends IEvents {
    matches: Events.Subject<IMatchEntity[]>,
}

interface ISearchEventsSignatures extends IEventsSignatures {
    matches: 'matches';
};

const SearchEventsSignatures = Object.assign({
    matches: 'matches'
}, EventsSignatures) as ISearchEventsSignatures;

interface ISearchEventsInterfaces extends IEventsInterfaces {
    matches: { self: 'object', matches: typeof Array }
}

const SearchEventsInterfaces = Object.assign({
    matches: { self: 'object', matches: Array },
}, EventsInterfaces) as ISearchEventsInterfaces;

export class StreamSearchComputation extends Computation<IEvents> {

    private readonly _events: ISearchEvents = {
        progress: new Events.Subject<IOperationProgress>(),
        matches: new Events.Subject<IMatchEntity[]>(),
        error: new Events.Subject<IComputationError>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(uuid: string) {
        super(uuid);
    }

    public getName(): string {
        return 'StreamSearchComputation';
    }

    public getEvents(): ISearchEvents {
        return this._events;
    }

    public getEventsSignatures(): ISearchEventsSignatures {
        return SearchEventsSignatures;
    }

    public getEventsInterfaces(): ISearchEventsInterfaces {
        return SearchEventsInterfaces;
    }


}

import { Computation } from './сomputation';
import { RustTimeFormatExtractOperationChannel } from '../native/index';

import * as Events from '../util/events';

export interface IExtractOptions {

}

export interface IExtractDTFormatResult {
    format: string;
    reg: string;
}

export interface IEvents {
    results: Events.Subject<IExtractDTFormatResult>,
    error: Events.Subject<Error>,
    destroyed: Events.Subject<void>,
}

interface IEventsSignatures {
    results: 'results';
    error: 'error';
    destroyed: 'destroyed';
};

const EventsInterface = {
    results: { self: 'object' },
    error: { self: Error },
    destroyed: { self: null },
};

export class StreamTimeFormatExtractComputation extends Computation<IEvents> {

    private readonly _events: IEvents = {
        results: new Events.Subject<any>(),
        error: new Events.Subject<Error>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(channel: RustTimeFormatExtractOperationChannel, uuid: string) {
        super(channel, uuid);
    }

    public getName(): string {
        return 'StreamTimeFormatExtractComputation';
    }

    public getEvents(): IEvents {
        return this._events;
    }

    public getEventsSignatures(): IEventsSignatures {
        return {
            results: 'results',
            error: 'error',
            destroyed: 'destroyed',
        };
    }

    public getEventsInterfaces() {
        return EventsInterface;
    }


}

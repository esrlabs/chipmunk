import { Computation } from './сomputation';
import { RustTimeFormatExtractOperationChannel } from '../native/index';
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

export interface IExtractOptions {

}

export interface IExtractDTFormatResult {
    format: string;
    reg: string;
}

export interface IExtractEvents extends IEvents {
    results: Events.Subject<IExtractDTFormatResult[]>,
}

interface IExtractEventsSignatures extends IEventsSignatures {
    results: 'results';
};

const ExtractEventsSignatures = Object.assign({
    results: 'results'
}, EventsSignatures) as IExtractEventsSignatures;

interface IExtractEventsInterfaces extends IEventsInterfaces {
    results: { self: 'object', matches: typeof Array }
}

const ExtractEventsInterfaces = Object.assign({
    results: { self: 'object', matches: Array },
}, EventsInterfaces) as IExtractEventsInterfaces;

export class StreamTimeFormatExtractComputation extends Computation<IEvents> {

    private readonly _events: IExtractEvents = {
        progress: new Events.Subject<IOperationProgress>(),
        results: new Events.Subject<IExtractDTFormatResult[]>(),
        error: new Events.Subject<IError>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(uuid: string) {
        super(uuid);
    }

    public getName(): string {
        return 'StreamTimeFormatExtractComputation';
    }

    public getEvents(): IExtractEvents {
        return this._events;
    }

    public getEventsSignatures(): IExtractEventsSignatures {
        return ExtractEventsSignatures;
    }

    public getEventsInterfaces(): IExtractEventsInterfaces {
        return ExtractEventsInterfaces;
    }


}

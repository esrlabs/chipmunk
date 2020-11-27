import { Computation } from './сomputation';
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

export interface IDetectOptions {

}

export interface IDetectDTFormatResult {
    format: string;
    reg: string;
}

export interface IDetectEvents extends IEvents {
    results: Events.Subject<IDetectDTFormatResult[]>,
}

interface IDetectEventsSignatures extends IEventsSignatures {
    results: 'results';
};

const DetectEventsSignatures = Object.assign({
    results: 'results'
}, EventsSignatures) as IDetectEventsSignatures;

interface IDetectEventsInterfaces extends IEventsInterfaces {
    results: { self: 'object', matches: typeof Array }
}

const DetectEventsInterfaces = Object.assign({
    results: { self: 'object', matches: Array },
}, EventsInterfaces) as IDetectEventsInterfaces;


export class StreamTimeFormatDetectComputation extends Computation<IEvents> {

    private readonly _events: IDetectEvents = {
        progress: new Events.Subject<IOperationProgress>(),
        results: new Events.Subject<IDetectDTFormatResult[]>(),
        error: new Events.Subject<IComputationError>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(uuid: string) {
        super(uuid);
    }

    public getName(): string {
        return 'StreamTimeFormatDetectComputation';
    }

    public getEvents(): IDetectEvents {
        return this._events;
    }

    public getEventsSignatures(): IDetectEventsSignatures {
        return DetectEventsSignatures;
    }

    public getEventsInterfaces(): IDetectEventsInterfaces {
        return DetectEventsInterfaces;
    }


}

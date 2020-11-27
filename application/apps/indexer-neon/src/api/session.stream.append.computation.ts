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

export interface IFileOptionsDLT {

}

export enum EFileOptionsRequirements {
    DLTOptions = 'DLTOptions',
    NoOptionsRequired = 'NoOptionsRequires',
}

export type TFileOptions = IFileOptionsDLT | undefined;

export interface IExecuteAppendOptions {
    filename: string;
    options: TFileOptions;
}

export class StreamAppendComputation extends Computation<IEvents> {
    private readonly _events: IEvents = {
        progress: new Events.Subject<IOperationProgress>(),
        error: new Events.Subject<IComputationError>(),
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

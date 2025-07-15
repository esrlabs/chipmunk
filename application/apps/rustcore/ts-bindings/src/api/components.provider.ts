import { Subject } from 'platform/env/subscription';
import { Computation } from '../provider/provider';
import {
    LoadingDoneEvent,
    LoadingErrorsEvent,
    LoadingErrorEvent,
    LoadingCancelledEvent,
} from 'platform/types/components';

import * as protocol from 'protocol';

export interface IComponentsEvents {
    LoadingDone: Subject<LoadingDoneEvent>;
    LoadingErrors: Subject<LoadingErrorsEvent>;
    LoadingError: Subject<LoadingErrorEvent>;
    LoadingCancelled: Subject<LoadingCancelledEvent>;
    Destroyed: Subject<void>;
}

export interface IComponentsEventsSignatures {
    LoadingDone: 'LoadingDone';
    LoadingErrors: 'LoadingErrors';
    LoadingError: 'LoadingError';
    LoadingCancelled: 'LoadingCancelled';
    Destroyed: 'Destroyed';
}

const SessionEventsSignatures: IComponentsEventsSignatures = {
    LoadingDone: 'LoadingDone',
    LoadingErrors: 'LoadingErrors',
    LoadingError: 'LoadingError',
    LoadingCancelled: 'LoadingCancelled',
    Destroyed: 'Destroyed',
};

export class ComponentsEventProvider extends Computation<
    IComponentsEvents,
    IComponentsEventsSignatures
> {
    private readonly _events: IComponentsEvents = {
        LoadingDone: new Subject<LoadingDoneEvent>(),
        LoadingErrors: new Subject<LoadingErrorsEvent>(),
        LoadingError: new Subject<LoadingErrorEvent>(),
        LoadingCancelled: new Subject<LoadingCancelledEvent>(),
        Destroyed: new Subject<void>(),
    };

    constructor(uuid: string) {
        super(uuid, protocol.decodeCallbackOptionsEvent);
    }

    public getName(): string {
        return 'ComponentsEventProvider';
    }

    public getEvents(): IComponentsEvents {
        return this._events;
    }

    public getEventsSignatures(): IComponentsEventsSignatures {
        return SessionEventsSignatures;
    }
}

import { Subject } from 'platform/env/subscription';
import { Computation } from '../provider/provider';
import { StaticFieldDesc, FieldLoadingError } from 'platform/types/bindings';

import * as protocol from 'protocol';

export interface LoadingDoneEvent {
    owner: string;
    fields: StaticFieldDesc[];
}

export interface LoadingErrorsEvent {
    owner: string;
    errors: FieldLoadingError[];
}

export interface LoadingErrorEvent {
    owner: string;
    error: string;
    fields: string[];
}
export interface LoadingCancelledEvent {
    owner: string;
    fields: string[];
}

export interface IComponentsEvents {
    LoadingDone: Subject<LoadingDoneEvent>;
    LoadingErrors: Subject<LoadingErrorsEvent>;
    LoadingError: Subject<LoadingErrorEvent>;
    LoadingCancelled: Subject<LoadingCancelledEvent>;
    Destroyed: Subject<void>;
}

export interface IComponentsEventsConvertors {}

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

export interface IComponentsEventsInterfaces {
    LoadingDone: { self: 'object'; owner: 'string'; fields: typeof Array };
    LoadingErrors: { self: 'object'; owner: 'string'; errors: typeof Array };
    LoadingError: { self: 'object'; owner: 'string'; error: 'string'; fields: typeof Array };
    LoadingCancelled: { self: 'object'; owner: 'string'; fields: typeof Array };
    Destroyed: { self: null };
}

const SessionEventsInterfaces: IComponentsEventsInterfaces = {
    LoadingDone: { self: 'object', owner: 'string', fields: Array },
    LoadingErrors: { self: 'object', owner: 'string', errors: Array },
    LoadingError: { self: 'object', owner: 'string', error: 'string', fields: Array },
    LoadingCancelled: { self: 'object', owner: 'string', fields: Array },
    Destroyed: { self: null },
};

export class ComponentsEventProvider extends Computation<
    IComponentsEvents,
    IComponentsEventsSignatures,
    IComponentsEventsInterfaces
> {
    private readonly _events: IComponentsEvents = {
        LoadingDone: new Subject<LoadingDoneEvent>(),
        LoadingErrors: new Subject<LoadingErrorsEvent>(),
        LoadingError: new Subject<LoadingErrorEvent>(),
        LoadingCancelled: new Subject<LoadingCancelledEvent>(),
        Destroyed: new Subject<void>(),
    };

    private readonly _convertors: IComponentsEventsConvertors = {};

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

    public getEventsInterfaces(): IComponentsEventsInterfaces {
        return SessionEventsInterfaces;
    }

    public getConvertor<T, O>(event: keyof IComponentsEventsSignatures, data: T): T | O | Error {
        const convertors = this._convertors as unknown as { [key: string]: (data: T) => T | O };
        if (typeof convertors[event] !== 'function') {
            return data;
        } else {
            return convertors[event](data);
        }
    }
}

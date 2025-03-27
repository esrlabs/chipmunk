import { Subject } from 'platform/env/subscription';
import { Computation } from '../provider/provider';
import { StaticFieldDesc } from 'platform/types/bindings';

import * as protocol from 'protocol';

export interface IComponentsEvents {
    Options: Subject<StaticFieldDesc[]>;
    Errors: Subject<[string, string][]>;
    Destroyed: Subject<void>;
}

export interface IComponentsEventsConvertors {}

export interface IComponentsEventsSignatures {
    Options: 'Options';
    Errors: 'Errors';
    Destroyed: 'Destroyed';
}

const SessionEventsSignatures: IComponentsEventsSignatures = {
    Options: 'Options',
    Errors: 'Errors',
    Destroyed: 'Destroyed',
};

export interface IComponentsEventsInterfaces {
    Options: { self: ['object', null] };
    Errors: { self: [typeof Array, null] };
    Destroyed: { self: null };
}

const SessionEventsInterfaces: IComponentsEventsInterfaces = {
    Options: { self: ['object', null] },
    Errors: { self: [Array, null] },
    Destroyed: { self: null },
};

export class ComponentsEventProvider extends Computation<
    IComponentsEvents,
    IComponentsEventsSignatures,
    IComponentsEventsInterfaces
> {
    private readonly _events: IComponentsEvents = {
        Options: new Subject<StaticFieldDesc[]>(),
        Errors: new Subject<[string, string][]>(),
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

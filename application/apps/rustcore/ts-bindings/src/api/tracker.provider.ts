import { Subject } from 'platform/env/subscription';
import { Computation } from '../provider/provider';

export interface Job {
    alias: string;
    uuid: string;
}

export interface JobProgress {
    uuid: string;
    ticks: Ticks;
}
export interface Ticks {
    count: number;
    state: string | undefined;
    total: number | undefined;
}

export interface ISessionEvents {
    Started: Subject<Job>;
    Stopped: Subject<string>;
    Ticks: Subject<JobProgress>;
}

interface ISessionEventsSignatures {
    Started: 'Started';
    Stopped: 'Stopped';
    Ticks: 'Ticks';
}

const SessionEventsSignatures: ISessionEventsSignatures = {
    Started: 'Started',
    Stopped: 'Stopped',
    Ticks: 'Ticks',
};

interface ISessionEventsInterfaces {
    Started: { self: 'object'; uuid: 'string'; alias: 'string' };
    Stopped: { self: 'string' };
    Ticks: {
        self: 'object';
        uuid: 'string';
        progress: [
            { self: 'object'; total: 'number'; count: 'number' },
            { self: 'object'; type: 'string' },
        ];
    };
}

const SessionEventsInterfaces: ISessionEventsInterfaces = {
    Started: { self: 'object', uuid: 'string', alias: 'string' },
    Stopped: { self: 'string' },
    Ticks: {
        self: 'object',
        uuid: 'string',
        progress: [
            { self: 'object', total: 'number', count: 'number' },
            { self: 'object', type: 'string' },
        ],
    },
};

export class EventProvider extends Computation<
    ISessionEvents,
    ISessionEventsSignatures,
    ISessionEventsInterfaces
> {
    private readonly _events: ISessionEvents = {
        Started: new Subject<Job>(),
        Stopped: new Subject<string>(),
        Ticks: new Subject<JobProgress>(),
    };

    private readonly _convertors = {};

    constructor(uuid: string) {
        super(uuid);
    }

    public getName(): string {
        return 'EventProvider';
    }

    public getEvents(): ISessionEvents {
        return this._events;
    }

    public getEventsSignatures(): ISessionEventsSignatures {
        return SessionEventsSignatures;
    }

    public getEventsInterfaces(): ISessionEventsInterfaces {
        return SessionEventsInterfaces;
    }

    public getConvertor<T, O>(event: keyof ISessionEventsSignatures, data: T): T | O | Error {
        const convertors = this._convertors as unknown as { [key: string]: (data: T) => T | O };
        if (typeof convertors[event] !== 'function') {
            return data;
        } else {
            return convertors[event](data);
        }
    }
}

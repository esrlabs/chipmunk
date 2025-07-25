import { Subject } from 'platform/env/subscription';
import { Computation } from '../provider/provider';

import * as protocol from 'protocol';

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

export class EventProvider extends Computation<ISessionEvents, ISessionEventsSignatures> {
    private readonly _events: ISessionEvents = {
        Started: new Subject<Job>(),
        Stopped: new Subject<string>(),
        Ticks: new Subject<JobProgress>(),
    };

    private readonly _convertors = {};

    constructor(uuid: string) {
        super(uuid, protocol.decodeLifecycleTransition);
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
}

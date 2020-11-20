import { Computation } from './сomputation';
import { RustMergeOperationChannel  } from '../native/index';

import * as Events from '../util/events';

export interface IFileToBeMerged {
    filename: string;
    datetimeFormat?: string;
    datetimeFormatRegExp?: string;
}

export interface IEvents {
    error: Events.Subject<Error>,
    destroyed: Events.Subject<void>,
}

interface IEventsSignatures {
    error: 'error';
    destroyed: 'destroyed';
};

const EventsInterface = {
    error: { self: Error },
    destroyed: { self: null },
};

export class StreamMergeComputation extends Computation<IEvents> {

    private readonly _events: IEvents = {
        error: new Events.Subject<Error>(),
        destroyed: new Events.Subject<void>(),
    };

    constructor(channel: RustMergeOperationChannel, uuid: string) {
        super(channel, uuid);
    }

    public getName(): string {
        return 'StreamMergeComputation';
    }

    public getEvents(): IEvents {
        return this._events;
    }

    public getEventsSignatures(): IEventsSignatures {
        return {
            error: 'error',
            destroyed: 'destroyed',
        };
    }

    public getEventsInterfaces() {
        return EventsInterface;
    }


}

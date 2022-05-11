import { File } from '@platform/types/files';

import { IDLTOptions, EMTIN, IDLTFilters } from '@platform/types/parsers/dlt';
import { Timezone } from '@ui/elements/timezones/timezone';
import { SourceDefinition } from '@platform/types/transport';

import { State as TransportState } from '@ui/elements/transport/state';

import * as Errors from './error';

export enum ConnectionType {
    Tcp = 'Tcp',
    Udp = 'Udp',
}
export const ENTITIES = {
    app_ids: 'app_ids',
    context_ids: 'context_ids',
    ecu_ids: 'ecu_ids',
};

export const NAMES: { [key: string]: string } = {
    [ENTITIES.app_ids]: 'Applications',
    [ENTITIES.context_ids]: 'Contexts',
    [ENTITIES.ecu_ids]: 'ECUs',
};

const CLogLevel: { [key: string]: number } = {
    [EMTIN.DLT_LOG_FATAL]: 1,
    [EMTIN.DLT_LOG_ERROR]: 2,
    [EMTIN.DLT_LOG_WARN]: 3,
    [EMTIN.DLT_LOG_INFO]: 4,
    [EMTIN.DLT_LOG_DEBUG]: 5,
    [EMTIN.DLT_LOG_VERBOSE]: 6,
};

export class State {
    public logLevel: EMTIN = EMTIN.DLT_LOG_VERBOSE;
    public fibex: File[] = [];
    public timezone: Timezone | undefined;
    public errors = {
        ecu: new Errors.ErrorState(Errors.Field.ecu),
        bindingAddress: new Errors.ErrorState(Errors.Field.bindingAddress),
        bindingPort: new Errors.ErrorState(Errors.Field.bindingPort),
    };
    public ecu: string = '';
    public transport: TransportState = new TransportState();
    public bindingAddress: string = '';
    public bindingPort: string = '';
    public connectionType: ConnectionType = ConnectionType.Tcp;

    public asOptions(): { source: SourceDefinition; options: IDLTOptions } {
        const filters: IDLTFilters = {};
        return {
            options: {
                logLevel: CLogLevel[this.logLevel] === undefined ? 0 : CLogLevel[this.logLevel],
                filters,
                fibex: this.fibex.map((f) => f.filename),
            },
            source: this.transport.asSourceDefinition(),
        };
    }
}

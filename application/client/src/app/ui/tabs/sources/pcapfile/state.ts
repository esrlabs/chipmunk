import { File } from '@platform/types/files';
import {
    IDLTOptions,
    EMTIN,
    LOG_LEVELS,
    NUM_LOGS_LEVELS,
    IDLTFilters,
} from '@platform/types/parsers/dlt';
import { Filter } from '@ui/env/entities/filter';
import { Timezone } from '@elements/timezones/timezone';
import { bridge } from '@service/bridge';
import { InternalAPI } from '@service/ilc';
import { Holder } from '@module/matcher';

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

export class State extends Holder {
    public logLevel: EMTIN = EMTIN.DLT_LOG_VERBOSE;
    public fibex: File[] = [];
    public filters: {
        entities: Filter;
    };
    public timezone: Timezone | undefined;

    constructor(ilc: InternalAPI) {
        super();
        this.filters = {
            entities: new Filter(ilc),
        };
    }

    public asOptions(): IDLTOptions {
        const filters: IDLTFilters = {};
        return {
            logLevel: LOG_LEVELS[this.logLevel] === undefined ? 0 : LOG_LEVELS[this.logLevel],
            filters,
            fibex: this.fibex.map((f) => f.filename),
            tz: this.timezone === undefined ? undefined : this.timezone.name,
        };
    }

    public fromOptions(options: IDLTOptions) {
        this.logLevel = NUM_LOGS_LEVELS[options.logLevel] as EMTIN;
        this.timezone = options.tz !== undefined ? Timezone.from(options.tz) : undefined;
        if (options.fibex.length > 0) {
            bridge
                .files()
                .getByPath(options.fibex)
                .then((files: File[]) => {
                    this.fibex = files;
                })
                .catch((err: Error) => {
                    console.error(`Fail to get files data: ${err.message}`);
                });
        }
    }

}

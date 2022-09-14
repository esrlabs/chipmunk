import { File } from '@platform/types/files';
import {
    IDLTOptions,
    StatisticInfo,
    LevelDistribution,
    EMTIN,
    LOG_LEVELS,
    NUM_LOGS_LEVELS,
    IDLTFilters,
} from '@platform/types/parsers/dlt';
import { StatEntity } from './structure/statentity';
import { Section } from './structure/section';
import { getTypedProp } from '@platform/env/obj';
import { Filter } from '@ui/env/entities/filter';
import { Summary } from './summary';
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
    public structure: Section[] = [];
    public fibex: File[] = [];
    public stat: StatisticInfo | undefined;
    public filters: {
        entities: Filter;
    };
    public summary: {
        total: Summary;
        selected: Summary;
    } = {
        total: new Summary(),
        selected: new Summary(),
    };
    public timezone: Timezone | undefined;

    constructor(ilc: InternalAPI) {
        super();
        this.filters = {
            entities: new Filter(ilc),
        };
    }

    public isStatLoaded(): boolean {
        return this.stat !== undefined;
    }

    public getSelectedEntities(): StatEntity[] {
        let selected: StatEntity[] = [];
        this.structure.forEach((section) => {
            selected = selected.concat(section.getSelected());
        });
        return selected;
    }

    public asOptions(): IDLTOptions {
        const filters: IDLTFilters = {};
        this.getSelectedEntities().forEach((entity) => {
            if ((filters as { [key: string]: string[] })[entity.parent] === undefined) {
                (filters as { [key: string]: string[] })[entity.parent] = [];
            }
            (filters as { [key: string]: string[] })[entity.parent].push(entity.id);
        });
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

    public struct(): {
        build(preselection?: IDLTFilters): void;
        filter(): void;
    } {
        return {
            build: (preselection?: IDLTFilters): void => {
                if (this.stat === undefined) {
                    return;
                }
                const stat = this.stat;
                const structure: Section[] = [];
                ['app_ids', 'context_ids', 'ecu_ids'].forEach((key: string) => {
                    const content: Array<[string, LevelDistribution]> = getTypedProp<
                        StatisticInfo,
                        Array<[string, LevelDistribution]>
                    >(stat, key);
                    const entities: StatEntity[] = content.map((record) => {
                        const entity = new StatEntity(record[0], key, record[1], this.matcher);
                        if (
                            preselection !== undefined &&
                            (preselection as any)[key] !== undefined
                        ) {
                            if (
                                ((preselection as any)[key] as string[]).indexOf(record[0]) !== -1
                            ) {
                                entity.select();
                            }
                        }
                        return entity;
                    });
                    structure.push(new Section(key, NAMES[key]).fill(entities));
                });
                this.structure = structure;
                this.buildSummary().all();
            },
            filter: (): void => {
                this.matcher.search(this.filters.entities.value());
                this.structure.forEach((structure) => {
                    structure.entities.sort(
                        (a: StatEntity, b: StatEntity) => b.getScore() - a.getScore(),
                    );
                    structure.update.emit();
                });
            },
        };
    }

    public buildSummary(): {
        total(): void;
        selected(): void;
        all(): void;
    } {
        return {
            total: (): void => {
                this.summary.total.reset();
                this.structure.forEach((structure) => {
                    structure.entities.forEach((entity) => {
                        this.summary.total.inc(entity);
                    });
                });
            },
            selected: (): void => {
                this.summary.selected.reset();
                this.structure.forEach((structure) => {
                    structure.entities.forEach((entity) => {
                        entity.selected && this.summary.selected.inc(entity);
                    });
                });
            },
            all: (): void => {
                this.buildSummary().total();
                this.buildSummary().selected();
            }
        };
    }
}

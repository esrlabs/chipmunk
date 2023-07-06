import { State as Base } from '../../state';
import { Section } from './structure/section';
import { Summary } from './summary';
import { StatEntity } from './structure/statentity';
import { getTypedProp } from '@platform/env/obj';

import * as Dlt from '@platform/types/observe/parser/dlt';

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
export class State extends Base {
    public structure: Section[] = [];
    public stat: Dlt.StatisticInfo | undefined;
    public summary: {
        total: Summary;
        selected: Summary;
    } = {
        total: new Summary(),
        selected: new Summary(),
    };

    protected files(): string[] {
        const files = this.observe.origin.files();
        if (files === undefined) {
            throw new Error(
                `Extra settings of DLT parser are available only for File and Concat origins`,
            );
        }
        return typeof files === 'string' ? [files] : files;
    }

    protected filters(): Dlt.IFilters | undefined {
        const parser = this.observe.parser.as<Dlt.Configuration>(Dlt.Configuration);
        if (parser === undefined) {
            throw new Error(`Observe object uses not ${Dlt.Configuration.alias()} parser.`);
        }
        return parser.configuration.filter_config;
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

    public struct(): {
        load(): void;
        build(preselection?: Dlt.IFilters): void;
        filter(value: string): void;
        supported(): boolean;
    } {
        return {
            supported: (): boolean => {
                const parser = this.observe.parser.as<Dlt.Configuration>(Dlt.Configuration);
                return parser === undefined ? false : parser.configuration.with_storage_header;
            },
            load: (): void => {
                if (!this.struct().supported()) {
                    return;
                }
                this.ref
                    .ilc()
                    .services.system.bridge.dlt()
                    .stat(this.files())
                    .then((stat) => {
                        // this.tab.setTitle(
                        //     this.files.length === 1
                        //         ? this.files[0].name
                        //         : `${this.files.length} DLT files`,
                        // );
                        this.stat = stat;
                        this.struct().build(this.filters());
                        this.ref.markChangesForCheck();
                    })
                    .catch((err: Error) => {
                        this.ref.log().error(`Fail to get DLT stat info: ${err.message}`);
                    });
            },
            build: (preselection?: Dlt.IFilters): void => {
                if (!this.struct().supported()) {
                    return;
                }
                if (this.stat === undefined) {
                    return;
                }
                const stat = this.stat;
                const structure: Section[] = [];
                ['app_ids', 'context_ids', 'ecu_ids'].forEach((key: string) => {
                    const content: Array<[string, Dlt.LevelDistribution]> = getTypedProp<
                        Dlt.StatisticInfo,
                        Array<[string, Dlt.LevelDistribution]>
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
            filter: (value: string): void => {
                if (!this.struct().supported()) {
                    return;
                }
                this.matcher.search(value);
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
                const conf = this.observe.parser.as<Dlt.Configuration>(Dlt.Configuration);
                if (conf === undefined) {
                    return;
                }
                conf.setDefaultsFilterConfig();
                this.structure.forEach((structure) => {
                    const selected = structure.getSelected().map((f) => f.id);
                    if (selected.length === 0) {
                        (conf.configuration.filter_config as any)[structure.key] = undefined;
                    } else {
                        (conf.configuration.filter_config as any)[structure.key] = selected;
                    }
                });
            },
            all: (): void => {
                this.buildSummary().total();
                this.buildSummary().selected();
            },
        };
    }
}

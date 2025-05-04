import { Section } from './structure/section';
import { Summary } from './summary';
import { DictionaryEntities } from './structure/statentity';
import { getTypedProp } from '@platform/env/obj';
import { NestedDictionaryStructure } from '../../element';
import { Holder as MatcherHolder } from '@module/matcher';

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

export class State extends MatcherHolder {
    public structure: Section[] = [];
    public summary:
        | {
              total: Summary;
              selected: Summary;
          }
        | undefined;

    constructor(
        protected readonly data: NestedDictionaryStructure,
        protected readonly dictionary: Map<string, string>,
    ) {
        super();
        this.struct().build(new Map());
    }

    public getName(key: string): string {
        const label = this.dictionary.get(key);
        return label ? label : key;
    }

    public getSelectedEntities(): DictionaryEntities[] {
        let selected: DictionaryEntities[] = [];
        this.structure.forEach((section) => {
            selected = selected.concat(section.getSelected());
        });
        return selected;
    }

    public struct(): {
        build(preselection: Map<string, string[]>): void;
        filter(value: string): void;
    } {
        return {
            build: (preselection: Map<string, string[]>): void => {
                const structure: Section[] = [];
                this.data.forEach((section, key_section) => {
                    const selected = preselection.get(key_section);
                    const entities: DictionaryEntities[] = [];
                    section.forEach((values, key_entity) => {
                        if (!this.summary) {
                            const map = new Map();
                            values.keys().forEach((key) => {
                                map.set(key, 0);
                            });
                            this.summary = { total: new Summary(map), selected: new Summary(map) };
                        }
                        const entity = new DictionaryEntities(
                            key_entity,
                            key_section,
                            values,
                            this.matcher,
                        );
                        if (selected && selected.includes(key_entity)) {
                            entity.select();
                        }
                        entities.push(entity);
                    });
                    structure.push(new Section(key_section, key_section).fill(entities));
                });
                this.structure = structure;
                this.buildSummary().all();
            },
            filter: (value: string): void => {
                this.matcher.search(value);
                this.structure.forEach((structure) => {
                    structure.entities.sort(
                        (a: DictionaryEntities, b: DictionaryEntities) =>
                            b.getScore() - a.getScore(),
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
                const total = this.summary ? this.summary.total : undefined;
                if (!total) {
                    return;
                }
                total.reset();
                this.structure.forEach((structure) => {
                    structure.entities.forEach((entity) => {
                        total.inc(entity);
                    });
                });
            },
            selected: (): void => {
                const selected = this.summary ? this.summary.selected : undefined;
                if (!selected) {
                    return;
                }
                selected.reset();
                this.structure.forEach((structure) => {
                    structure.entities.forEach((entity) => {
                        entity.selected && selected.inc(entity);
                    });
                });
                // const conf = this.observe.parser.as<Dlt.Configuration>(Dlt.Configuration);
                // if (conf === undefined) {
                //     return;
                // }
                // conf.setDefaultsFilterConfig();
                // let app_id_count = 0;
                // let context_id_count = 0;
                // this.structure.forEach((structure) => {
                //     if (structure.key === ENTITIES.app_ids) {
                //         app_id_count = structure.entities.length;
                //     } else if (structure.key === ENTITIES.context_ids) {
                //         context_id_count = structure.entities.length;
                //     }
                //     const selected = structure.getSelected().map((f) => f.id);
                //     if (selected.length === 0) {
                //         (conf.configuration.filter_config as any)[structure.key] = undefined;
                //     } else {
                //         (conf.configuration.filter_config as any)[structure.key] = selected;
                //     }
                // });
                // if (conf.configuration.filter_config) {
                //     conf.configuration.filter_config.app_id_count = app_id_count;
                //     conf.configuration.filter_config.context_id_count = context_id_count;
                // }
            },
            all: (): void => {
                this.buildSummary().total();
                this.buildSummary().selected();
            },
        };
    }
}

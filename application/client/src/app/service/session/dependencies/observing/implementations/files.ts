import { Provider as Base } from '../provider';
import { ObserveSource } from '@service/session/dependencies/observing/source';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { List } from '@ui/views/sidebar/observe/lists/file/component';
import { IMenuItem } from '@ui/service/contextmenu';

import * as $ from '@platform/types/observe';

export class Provider extends Base {
    private _sources: ObserveSource[] = [];
    private _processed: string[] = [];

    public contextMenu(source: ObserveSource): IMenuItem[] {
        const items: IMenuItem[] = [];
        const observer = source.observer;
        if (observer !== undefined) {
            items.push({
                caption: 'Stop tailing',
                handler: () => {
                    observer.abort().catch((err: Error) => {
                        this.logger.error(`Fail to abort observing (file tailing): ${err.message}`);
                    });
                },
            });
        }
        return items;
    }

    public update(sources: ObserveSource[]): Provider {
        const added = sources.filter((s) => !this._processed.includes(s.uuid()));
        // Add files
        this._sources.push(
            ...added.filter(
                (source) => source.observe.origin.nature() instanceof $.Origin.File.Configuration,
            ),
        );
        // Add files from concat-container
        added.map((source) => {
            const concat = source.observe.origin.as<$.Origin.Concat.Configuration>(
                $.Origin.Concat.Configuration,
            );
            if (concat === undefined) {
                return;
            }
            const origins = concat.asFileOrigins();
            const parser = source.observe.parser.sterilized();
            const files = origins.map((origin) => {
                return new ObserveSource(new $.Observe({ origin, parser })).asChild();
            });
            this._sources.push(...files);
        });
        this._processed.push(...added.map((a) => a.uuid()));
        Base.overwrite(sources, this._sources);
        return this;
    }

    public sources(): ObserveSource[] {
        return this._sources;
    }

    public getPanels(): {
        list(): {
            name(): string;
            desc(): string;
            comp(): IComponentDesc;
        };
        nocontent(): {
            name(): string | undefined;
            desc(): string | undefined;
            comp(): IComponentDesc | undefined;
        };
    } {
        return {
            list: (): {
                name(): string;
                desc(): string;
                comp(): IComponentDesc;
            } => {
                return {
                    name: (): string => {
                        return `Files`;
                    },
                    desc: (): string => {
                        return this._sources.length > 0 ? this._sources.length.toString() : '';
                    },
                    comp: (): IComponentDesc => {
                        return {
                            factory: List,
                            inputs: {
                                provider: this,
                            },
                        };
                    },
                };
            },

            nocontent: (): {
                name(): string | undefined;
                desc(): string | undefined;
                comp(): IComponentDesc | undefined;
            } => {
                return {
                    name: (): string | undefined => {
                        return undefined;
                    },
                    desc: (): string | undefined => {
                        return undefined;
                    },
                    comp: (): IComponentDesc | undefined => {
                        return undefined;
                    },
                };
            },
        };
    }

    public override getNewSourceError(): Error | undefined {
        const active = this._sources.find((s) => s.observer !== undefined);
        if (active !== undefined) {
            return new Error(`Cannot attach new source while file is tailing`);
        }
        if (this._sources.length !== 1) {
            return undefined;
        }
        const singleTextFile = this._sources.find((s) => {
            const file = s.observe.origin.as<$.Origin.File.Configuration>(
                $.Origin.File.Configuration,
            );
            if (file === undefined) {
                return false;
            }
            if (file.filetype() === $.Types.File.FileType.Text && !s.child) {
                return true;
            }
            return false;
        });
        if (singleTextFile !== undefined) {
            return new Error(
                `Single file has been opened. In this case you cannot attach new source(s).`,
            );
        }
        return undefined;
    }
}

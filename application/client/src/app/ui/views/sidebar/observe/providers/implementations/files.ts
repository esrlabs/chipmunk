import { Provider as Base } from '../provider';
import { ObserveSource } from '@service/session/dependencies/observe/source';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { List } from '../../lists/file/component';
import { IMenuItem } from '@ui/service/contextmenu';
import { State, KEY } from '../../states/files';

export class Provider extends Base<State> {
    private _sources: ObserveSource[] = [];

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
        this._sources = sources.filter((source) => source.source.asFile() !== undefined);
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
        details(): {
            name(): string | undefined;
            desc(): string | undefined;
            comp(): IComponentDesc | undefined;
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
            details: (): {
                name(): string | undefined;
                desc(): string | undefined;
                comp(): IComponentDesc | undefined;
            } => {
                return {
                    name: (): string | undefined => {
                        return ``;
                    },
                    desc: (): string | undefined => {
                        return '';
                    },
                    comp: (): IComponentDesc | undefined => {
                        return undefined;
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

    public storage(): {
        get(): State;
        key(): string;
    } {
        return {
            get: (): State => {
                return new State();
            },
            key: (): string => {
                return KEY;
            },
        };
    }

    public override getNewSourceError(): Error | undefined {
        const active = this._sources.find((s) => s.observer !== undefined);
        if (active !== undefined) {
            return new Error(`Cannot attach new source while file is tailing`);
        }
        const single = this._sources.find(
            (s) => s.source.is().file && s.source.parent === undefined,
        );
        if (single !== undefined) {
            return new Error(
                `Single file has been opened. In this case you cannot attach new source(s).`,
            );
        }
        return undefined;
    }
}

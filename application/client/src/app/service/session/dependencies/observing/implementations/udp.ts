import { Provider as Base } from '../provider';
import { ObserveSource } from '@service/session/dependencies/observing/source';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { List } from '@ui/views/sidebar/observe/lists/udp/component';
import { IMenuItem } from '@ui/service/contextmenu';
import { opener } from '@service/opener';
import { Source } from '@platform/types/transport';

export class Provider extends Base {
    private _sources: ObserveSource[] = [];

    public contextMenu(source: ObserveSource): IMenuItem[] {
        const items: IMenuItem[] = [];
        const observer = source.observer;
        if (observer !== undefined) {
            items.push({
                caption: 'Disconnect',
                handler: () => {
                    observer.abort().catch((err: Error) => {
                        this.logger.error(
                            `Fail to abort observing (udp listening): ${err.message}`,
                        );
                    });
                },
            });
        } else {
            items.push({
                caption: 'Connect',
                handler: () => {
                    this.repeat(source.source).catch((err: Error) => {
                        this.logger.error(`Fail to repeat: ${err.message}`);
                    });
                },
            });
        }
        return items;
    }

    public openNewSessionOptions() {
        opener
            .stream(undefined, true, Source.Udp)
            .dlt()
            .catch((err: Error) => {
                this.logger.error(`Fail to open options: ${err.message}`);
            });
    }

    public update(sources: ObserveSource[]): Provider {
        this._sources = sources.filter((source) => source.source.is().udp);
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
                        return `UPD Connections`;
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
}
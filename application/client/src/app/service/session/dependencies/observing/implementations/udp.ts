import { Provider as Base } from '../provider';
import { ObserveSource } from '@service/session/dependencies/observing/source';
import { IComponentDesc } from '@elements/containers/dynamic/component';
import { List } from '@ui/views/sidebar/observe/lists/udp/component';
import { IMenuItem } from '@ui/service/contextmenu';
import { session } from '@service/session';

import * as $ from '@platform/types/observe';
import * as Factory from '@platform/types/observe/factory';

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
                    this.clone(source.observe).catch((err: Error) => {
                        this.logger.error(`Fail to repeat: ${err.message}`);
                    });
                },
            });
        }
        return items;
    }

    public openNewSessionOptions() {
        session.initialize().configure(new Factory.Stream().udp().get());
    }

    public update(sources: ObserveSource[]): Provider {
        this._sources = sources.filter(
            (source) =>
                source.observe.origin.nature() instanceof $.Origin.Stream.Stream.UDP.Configuration,
        );
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

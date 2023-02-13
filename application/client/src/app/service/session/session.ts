import { TabsService, ITabAPI, ETabsListDirection, TabsOptions } from '@elements/tabs/service';
import { Storage } from '@env/storage';
import { Stream } from './dependencies/stream';
import { Search } from './dependencies/search';
import { Indexed } from './dependencies/indexed';
import { Cursor } from './dependencies/cursor';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { cutUuid } from '@log/index';
import { Render } from '@schema/render';
import { components } from '@env/decorators/initial';
import { Base } from './base';
import { Bookmarks } from './dependencies/bookmarks';
import { Exporter } from './dependencies/exporter';
import { Subscriber } from '@platform/env/subscription';
import { IRange, fromIndexes } from '@platform/types/range';

import * as ids from '@schema/ids';
import * as Requests from '@platform/ipc/request';

export { Stream };

@SetupLogger()
export class Session extends Base {
    public readonly storage: Storage = new Storage();
    public readonly stream: Stream = new Stream();
    public readonly search: Search = new Search();
    public readonly indexed: Indexed = new Indexed();
    public readonly bookmarks: Bookmarks = new Bookmarks();
    public readonly cursor: Cursor = new Cursor();
    public readonly exporter: Exporter = new Exporter();
    public readonly render: Render<unknown>;

    private _uuid!: string;
    private _tab!: ITabAPI;
    private readonly _subscriber: Subscriber = new Subscriber();
    private readonly _toolbar: TabsService = new TabsService();
    private readonly _sidebar: TabsService = new TabsService({
        options: new TabsOptions({ direction: ETabsListDirection.left }),
    });
    protected inited: boolean = false;

    constructor(render: Render<unknown>) {
        super();
        this.render = render;
        this._toolbar.add({
            uuid: ids.TOOLBAR_TAB_SEARCH,
            name: 'Search',
            active: true,
            closable: false,
            content: {
                factory: components.get('app-views-search'),
                inputs: {
                    session: this,
                },
            },
        });
        this._toolbar.add({
            uuid: ids.TOOLBAR_TAB_DETAILS,
            name: 'Details',
            active: false,
            closable: false,
            content: {
                factory: components.get('app-views-details'),
                inputs: {
                    session: this,
                },
            },
        });
        this._toolbar.add({
            uuid: ids.TOOLBAR_TAB_PRESET,
            name: 'Presets / History',
            active: false,
            closable: false,
            content: {
                factory: components.get('app-views-history'),
                inputs: {
                    session: this,
                },
            },
        });
        this._toolbar.add({
            uuid: ids.TOOLBAR_TAB_CHART,
            name: 'Chart',
            active: false,
            closable: false,
            content: {
                factory: components.get('app-views-chart'),
                inputs: {
                    session: this,
                },
            },
        });
        this._sidebar.add({
            uuid: ids.SIDEBAR_TAB_OBSERVING,
            name: 'Observing',
            active: false,
            closable: false,
            content: {
                factory: components.get('app-views-observe-list'),
                inputs: {
                    session: this,
                },
            },
        });
        this._sidebar.add({
            uuid: ids.SIDEBAR_TAB_FILTERS,
            name: 'Filters',
            active: true,
            closable: false,
            content: {
                factory: components.get('app-views-filters'),
                inputs: {
                    session: this,
                },
            },
        });
    }

    public init(): Promise<string> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send<Requests.Session.Create.Response>(
                Requests.Session.Create.Response,
                new Requests.Session.Create.Request({}),
            )
                .then((response) => {
                    this.setLoggerName(`Session: ${cutUuid(response.uuid)}`);
                    this._uuid = response.uuid;
                    this.stream.init(this._uuid);
                    this.cursor.init(this._uuid);
                    this.indexed.init(this._uuid);
                    this.bookmarks.init(this._uuid, this.cursor);
                    this.search.init(this._uuid);
                    this.exporter.init(this._uuid, this.stream, this.search);
                    this.inited = true;
                    resolve(this._uuid);
                })
                .catch(reject);
        });
    }

    public destroy(): Promise<void> {
        this.storage.destroy();
        this.search.destroy();
        this.indexed.destroy();
        this.stream.destroy();
        this.bookmarks.destroy();
        this.cursor.destroy();
        this.exporter.destroy();
        this._subscriber.unsubscribe();
        if (!this.inited) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            Requests.IpcRequest.send<Requests.Session.Destroy.Response>(
                Requests.Session.Destroy.Response,
                new Requests.Session.Destroy.Request({ session: this.uuid() }),
            )
                .then((response) => {
                    if (response.error !== undefined) {
                        this.log().error(`Error on destroying session: ${response.error}`);
                    }
                    resolve();
                })
                .catch((err: Error) => {
                    this.log().error(`Error on sending destroy session reques: ${err.message}`);
                    resolve();
                });
        });
    }

    public bind(tab: ITabAPI) {
        this._tab = tab;
    }

    public uuid(): string {
        return this._uuid;
    }

    public sidebar(): TabsService | undefined {
        return this._sidebar;
    }

    public toolbar(): TabsService | undefined {
        return this._toolbar;
    }

    public switch(): {
        toolbar: {
            search(): void;
            presets(): void;
        };
    } {
        return {
            toolbar: {
                search: (): void => {
                    this._toolbar.setActive(ids.TOOLBAR_TAB_SEARCH);
                },
                presets: (): void => {
                    this._toolbar.setActive(ids.TOOLBAR_TAB_PRESET);
                },
            },
        };
    }

    public isBound(): boolean {
        return true;
    }

    public close(): void {
        this._tab.close();
    }

    public selection(): {
        indexes(): number[];
        ranges(): IRange[];
    } {
        return {
            indexes: (): number[] => {
                const selected = this.cursor.get().slice();
                selected.sort((a, b) => (a > b ? 1 : -1));
                return selected;
            },
            ranges: (): IRange[] => {
                return fromIndexes(this.selection().indexes());
            },
        };
    }

    public title(): {
        set(title: string): Error | undefined;
        get(): Error | string;
    } {
        return {
            set: (title: string): Error | undefined => {
                return this._tab.setTitle(title);
            },
            get: (): Error | string => {
                return this._tab.getTitle();
            },
        };
    }
}
export interface Session extends LoggerInterface {}

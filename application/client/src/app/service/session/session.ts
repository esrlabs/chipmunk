import { TabsService, ITabAPI, ETabsListDirection, TabsOptions } from '@elements/tabs/service';
import { Storage } from '@env/storage';
import { Stream } from './dependencies/stream';
import { Search } from './dependencies/search';
import { Cursor } from './dependencies/cursor';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { cutUuid } from '@log/index';
import { Render } from '@schema/render';
import { components } from '@env/decorators/initial';
import { Base } from './base';
import { Bookmarks } from './dependencies/bookmarks';
import { Cache } from './dependencies/cache';

import * as Requests from '@platform/ipc/request';

export { Stream };

@SetupLogger()
export class Session extends Base {
    private _uuid!: string;
    private _tab!: ITabAPI;
    public readonly storage: Storage = new Storage();
    public readonly stream: Stream = new Stream();
    public readonly search: Search = new Search();
    public readonly bookmarks: Bookmarks = new Bookmarks();
    public readonly cursor: Cursor = new Cursor();
    public readonly cache: Cache = new Cache();
    public readonly render: Render<unknown>;

    private readonly _toolbar: TabsService = new TabsService();
    private readonly _sidebar: TabsService = new TabsService({
        options: new TabsOptions({ direction: ETabsListDirection.left }),
    });
    protected inited: boolean = false;

    constructor(render: Render<unknown>) {
        super();
        this.render = render;
        this._toolbar.add({
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
        this._sidebar.add({
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
                    this.bookmarks.init(this._uuid, this.cursor);
                    this.cache.init(this._uuid, this.cursor, this.stream);
                    this.search.init(this._uuid, this.bookmarks, this.cache);
                    this.inited = true;
                    resolve(this._uuid);
                })
                .catch(reject);
        });
    }

    public destroy(): Promise<void> {
        this.storage.destroy();
        this.search.destroy();
        this.stream.destroy();
        this.bookmarks.destroy();
        this.cursor.destroy();
        this.cache.destroy();
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

    public isBound(): boolean {
        return true;
    }
}
export interface Session extends LoggerInterface {}

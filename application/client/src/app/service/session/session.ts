import { TabsService, ITabAPI } from '@elements/tabs/service';
import { Storage } from '@env/storage';
import { Stream } from './dependencies/stream';
import { Search } from './dependencies/search';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { cutUuid } from '@log/index';
import { TargetFile } from '@platform/types/files';
import { Render } from '@schema/render';
import { components } from '@env/decorators/initial';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

export { Stream };

@SetupLogger()
export class Session {
    private _uuid!: string;
    private _tab!: ITabAPI;
    public readonly storage: Storage = new Storage();
    public readonly stream: Stream = new Stream();
    public readonly search: Search = new Search();
    public readonly render: Render<unknown>;
    public readonly toolbar: TabsService = new TabsService();
    public readonly sidebar: TabsService = new TabsService();

    constructor(render: Render<unknown>) {
        this.render = render;
        this.toolbar.add({
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
    }

    public init(inputs: { file?: TargetFile }): Promise<string> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send<Requests.Session.Create.Response>(
                Requests.Session.Create.Response,
                new Requests.Session.Create.Request(inputs),
            )
                .then((response) => {
                    this.setLoggerName(`Session: ${cutUuid(response.uuid)}`);
                    this._uuid = response.uuid;
                    this.stream.init(this._uuid);
                    this.search.init(this._uuid);
                    resolve(this._uuid);
                })
                .catch(reject);
        });
    }

    public destroy(): Promise<void> {
        this.storage.destroy();
        this.search.destroy();
        this.stream.destroy();
        return Promise.resolve();
    }

    public bind(tab: ITabAPI) {
        this._tab = tab;
    }

    public uuid(): string {
        return this._uuid;
    }
}
export interface Session extends LoggerInterface {}

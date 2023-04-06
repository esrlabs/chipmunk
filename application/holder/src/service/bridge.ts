import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';
import { Logger } from '@env/logs/index';

import * as Requests from 'platform/ipc/request';
import * as RequestHandlers from './bridge/index';
import * as Events from 'platform/ipc/event';

@DependOn(electron)
@SetupService(services['bridge'])
export class Service extends Implementation {
    protected clientLogger: Logger | undefined = new Logger('Client');

    public override ready(): Promise<void> {
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Actions.UrlInBrowser.Request,
                    RequestHandlers.Actions.BrowserUrl.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.App.Version.Request,
                    RequestHandlers.App.Version.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.Open.Request,
                    RequestHandlers.File.Open.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.Concat.Request,
                    RequestHandlers.File.Concat.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.Save.Request,
                    RequestHandlers.File.Save.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Connect.Dlt.Request,
                    RequestHandlers.Connect.Dlt.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Connect.Text.Request,
                    RequestHandlers.Connect.Text.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.Select.Request,
                    RequestHandlers.File.Select.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Folder.Select.Request,
                    RequestHandlers.Folder.Select.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Folder.Choose.Request,
                    RequestHandlers.Folder.Choose.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Folder.Ls.Request,
                    RequestHandlers.Folder.Ls.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Folder.Delimiter.Request,
                    RequestHandlers.Folder.Delimiter.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.File.Request,
                    RequestHandlers.File.File.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.Exists.Request,
                    RequestHandlers.File.Exists.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.Name.Request,
                    RequestHandlers.File.Name.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Os.List.Request,
                    RequestHandlers.Os.List.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Os.AsFSEntity.Request,
                    RequestHandlers.Os.AsFSEntity.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Os.HomeDir.Request,
                    RequestHandlers.Os.HomeDir.handler,
                ),
        );
        this.register(
            Events.IpcEvent.subscribe(Events.Logs.Write.Event, (event: Events.Logs.Write.Event) => {
                this.clientLogger !== undefined &&
                    this.clientLogger.write(event.message, event.level);
            }),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        this.clientLogger = undefined;
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const bridge = register(new Service());

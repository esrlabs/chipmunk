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
    protected logger: Logger | undefined;

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
                    Requests.App.Changelogs.Request,
                    RequestHandlers.App.Changelogs.handler,
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
                    Requests.File.Copy.Request,
                    RequestHandlers.File.Copy.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.Read.Request,
                    RequestHandlers.File.Read.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.ExportSession.Request,
                    RequestHandlers.File.ExportSession.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.CopyFile.Request,
                    RequestHandlers.File.CopyFile.handler,
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
                if (this.logger === undefined) {
                    this.logger = new Logger('CLIENT');
                }
                this.logger.publish(`[C]${event.message}`, event.level);
                this.logger.store(`[C]${event.message}`, event.level);
            }),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        this.logger = undefined;
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const bridge = register(new Service());

import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';
import { Jobs } from 'rustcore';
import { Mutable } from 'platform/types/unity/mutable';

import * as Requests from 'platform/ipc/request';
import * as RequestHandlers from './unbound/index';

@DependOn(electron)
@SetupService(services['unbound'])
export class Service extends Implementation {
    public readonly jobs!: Jobs;

    public override async ready(): Promise<void> {
        (this as Mutable<Service>).jobs = await Jobs.create();
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Dlt.Stat.Request,
                    RequestHandlers.Dlt.Stat.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Os.Shells.Request,
                    RequestHandlers.Os.Shells.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Os.EnvVars.Request,
                    RequestHandlers.Os.EnvVars.handler,
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
                    Requests.File.Checksum.Request,
                    RequestHandlers.File.Checksum.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.File.IsBinary.Request,
                    RequestHandlers.File.IsBinary.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Serial.Ports.Request,
                    RequestHandlers.Serial.Ports.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.ListInstalled.Request,
                    RequestHandlers.Plugins.ListInstalled.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.ListInvalid.Request,
                    RequestHandlers.Plugins.ListInvalid.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.ListInstalledPaths.Request,
                    RequestHandlers.Plugins.ListInstalledPaths.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.ListInvalidPaths.Request,
                    RequestHandlers.Plugins.ListInvalidPaths.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.InstalledPluginInfo.Request,
                    RequestHandlers.Plugins.InstalledPluginInfo.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.InvalidPluginInfo.Request,
                    RequestHandlers.Plugins.InvalidPluginInfo.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.PluginRunData.Request,
                    RequestHandlers.Plugins.PluginRunData.handler,
                ),
        );
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.Reload.Request,
                    RequestHandlers.Plugins.Relaod.handler,
                ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return this.jobs.destroy().catch((err: Error) => {
            this.log().error(`Fail to shutdown Jobs: ${err.message}`);
        });
    }
}
export interface Service extends Interface {}
export const unbound = register(new Service());

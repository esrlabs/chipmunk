import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';
import { Components } from 'rustcore';
import { Mutable } from 'platform/types/unity/mutable';

import * as RequestHandlers from './components/index';
import * as Requests from 'platform/ipc/request';
import * as Events from 'platform/ipc/event';

import {
    LoadingCancelledEvent,
    LoadingDoneEvent,
    LoadingErrorEvent,
    LoadingErrorsEvent,
} from 'platform/types/components';

@DependOn(electron)
@SetupService(services['components'])
export class Service extends Implementation {
    public readonly components!: Components;

    public override async ready(): Promise<void> {
        (this as Mutable<Service>).components = await Components.create();
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Components.Abort.Request,
                    RequestHandlers.Abort.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Components.GetOptions.Request,
                    RequestHandlers.GetOptions.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Components.GetIdent.Request,
                    RequestHandlers.GetIdent.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Components.GetOutputRender.Request,
                    RequestHandlers.GetOutputRender.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Components.IsSdeSupported.Request,
                    RequestHandlers.IsSdeSupported.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Components.GetParsers.Request,
                    RequestHandlers.GetParsers.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Components.GetSources.Request,
                    RequestHandlers.GetSources.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Components.Validate.Request,
                    RequestHandlers.Validate.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.ListInstalled.Request,
                    RequestHandlers.Plugins.ListInstalled.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.ListInvalid.Request,
                    RequestHandlers.Plugins.ListInvalid.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.ListInstalledPaths.Request,
                    RequestHandlers.Plugins.ListInstalledPaths.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.ListInvalidPaths.Request,
                    RequestHandlers.Plugins.ListInvalidPaths.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.InstalledPluginInfo.Request,
                    RequestHandlers.Plugins.InstalledPluginInfo.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.InvalidPluginInfo.Request,
                    RequestHandlers.Plugins.InvalidPluginInfo.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.PluginRunData.Request,
                    RequestHandlers.Plugins.PluginRunData.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.Reload.Request,
                    RequestHandlers.Plugins.Relaod.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.AddPlugin.Request,
                    RequestHandlers.Plugins.AddPlugin.handler,
                ),
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Plugins.RemovePlugin.Request,
                    RequestHandlers.Plugins.RemovePlugin.handler,
                ),
            this.components.getEvents().LoadingDone.subscribe((event: LoadingDoneEvent) => {
                Events.IpcEvent.emit(
                    new Events.Components.LoadingDone.Event({
                        event,
                    }),
                );
            }),
            this.components.getEvents().LoadingError.subscribe((event: LoadingErrorEvent) => {
                Events.IpcEvent.emit(
                    new Events.Components.LoadingError.Event({
                        event,
                    }),
                );
            }),
            this.components.getEvents().LoadingErrors.subscribe((event: LoadingErrorsEvent) => {
                Events.IpcEvent.emit(
                    new Events.Components.LoadingErrors.Event({
                        event,
                    }),
                );
            }),
            this.components
                .getEvents()
                .LoadingCancelled.subscribe((event: LoadingCancelledEvent) => {
                    Events.IpcEvent.emit(
                        new Events.Components.LoadingCancelled.Event({
                            event,
                        }),
                    );
                }),
            this.components.getEvents().Destroyed.subscribe(() => {
                // Stop getting incoming requests
                this.unsubscribe();
            }),
        );

        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return this.components.destroy().catch((err: Error) => {
            this.log().error(`Fail to shutdown Components: ${err.message}`);
        });
    }
}
export interface Service extends Interface {}
export const components = register(new Service());

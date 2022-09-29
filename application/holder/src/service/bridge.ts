import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { services } from '@register/services';
import { electron } from '@service/electron';

import * as Requests from 'platform/ipc/request';
import * as RequestHandlers from './bridge/index';

@DependOn(electron)
@SetupService(services['bridge'])
export class Service extends Implementation {
    public override ready(): Promise<void> {
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
                    Requests.File.File.Request,
                    RequestHandlers.File.File.handler,
                ),
        );
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
                    Requests.Serial.Ports.Request,
                    RequestHandlers.Serial.Ports.handler,
                ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return Promise.resolve();
    }
}
export interface Service extends Interface {}
export const bridge = register(new Service());

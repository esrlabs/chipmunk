import {
    SetupService,
    Interface,
    Implementation,
    DependOn,
    register,
} from '@platform/entity/service';
import { paths } from '@service/paths';
import { Window } from '@service/electron/window';
import { Dialogs } from '@service/electron/dialogs';
import { services } from '@register/services';
import { app, session } from 'electron';
import { Transport } from '@platform/ipc/transport';

@DependOn(paths)
@SetupService(services['electron'])
export class Service extends Implementation {
    private _window!: Window;
    private _dialogs!: Dialogs;

    public override init(): Promise<void> {
        this._window = new Window();
        this._dialogs = new Dialogs();
        return Promise.resolve();
    }

    public override async ready(): Promise<void> {
        await app.whenReady();
        // Setup minimal security requirements for angular app
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data:; ",
                        "trusted-types angular angular#unsafe-bypass; require-trusted-types-for 'script';",
                    ],
                },
            });
        });
        await this._window.create();
        this._dialogs.bind(this._window.getWindow());
        return Promise.resolve();
    }

    public ipc(): Transport {
        return this._window.ipc();
    }

    public dialogs(): Dialogs {
        return this._dialogs;
    }
}
export interface Service extends Interface {}
export const electron = register(new Service());

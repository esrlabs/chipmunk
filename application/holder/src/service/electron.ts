import {
    SetupService,
    Interface,
    Implementation,
    DependOn,
    register,
} from 'platform/entity/service';
import { paths } from '@service/paths';
import { Window } from '@service/electron/window';
import { Dialogs } from '@service/electron/dialogs';
import { services } from '@register/services';
import { app, session } from 'electron';
import { Transport } from 'platform/ipc/transport';
import { Subjects, Subject } from 'platform/env/subscription';
import { Protocol } from './electron/protocol';

@DependOn(paths)
@SetupService(services['electron'])
export class Service extends Implementation {
    public subjects: Subjects<{
        closing: Subject<void>;
        closed: Subject<void>;
    }> = new Subjects({
        closing: new Subject<void>(),
        closed: new Subject<void>(),
    });
    private _window!: Window;
    private _dialogs!: Dialogs;
    private _protocol: Protocol = new Protocol();
    private _state: {
        closing: boolean;
        closed: boolean;
    } = {
        closing: false,
        closed: false,
    };

    public override init(): Promise<void> {
        this._window = new Window();
        this._dialogs = new Dialogs();
        return Promise.resolve();
    }

    public override async ready(): Promise<void> {
        await app.whenReady();
        // Register protocol
        this._protocol.register();
        // Setup minimal security requirements for angular app
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self' data: https: http: attachment: 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * 'self' data: https: http: attachment:;",
                        "trusted-types angular angular#unsafe-bypass; require-trusted-types-for 'script';",
                    ],
                },
            });
        });
        await this._window.create();
        this._dialogs.bind(this._window.instance().get());
        this._window
            .instance()
            .get()
            .once('close', () => {
                this._state.closing = true;
                this.subjects.get().closing.emit();
            });
        this._window
            .instance()
            .get()
            .once('closed', () => {
                this._state.closed = true;
                this.subjects.get().closed.emit();
            });
        return Promise.resolve();
    }

    public override async destroy(): Promise<void> {
        this.subjects.destroy();
        await this._window.destroy().catch((err: Error) => {
            this.log().error(`Fail to destroy window controller: ${err.message}`);
        });
        return Promise.resolve();
    }

    public window(): Window {
        return this._window;
    }

    public ipc(): Transport {
        return this._window.ipc();
    }

    public dialogs(): Dialogs {
        return this._dialogs;
    }

    public state(): {
        closing(): boolean;
        closed(): boolean;
    } {
        return {
            closing: (): boolean => {
                return this._state.closing;
            },
            closed: (): boolean => {
                return this._state.closed;
            },
        };
    }
}
export interface Service extends Interface {}
export const electron = register(new Service());

import * as Url from 'url';

import { BrowserWindow, dialog, shell, OpenDialogReturnValue } from 'electron';
import { IPCMessages, Subscription } from '../../services/service.electron';

import Logger from '../../tools/env.logger';
import ControllerElectronIpc from './controller.electron.ipc';

export default class ControllerElectronEnv {
    private _window: BrowserWindow;
    private _guid: string;
    private _logger: Logger = new Logger('ControllerElectronEnv');
    private _ipc: ControllerElectronIpc;
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(guid: string, window: BrowserWindow, ipc: ControllerElectronIpc) {
        this._guid = guid;
        this._ipc = ipc;
        this._window = window;
    }

    public init(): Promise<void> {
        return Promise.all([
            this._ipc
                .subscribe(
                    IPCMessages.ElectronEnvPlatformRequest,
                    this._ipc_ElectronEnvPlatformRequest.bind(this),
                )
                .then((subscription: Subscription) => {
                    this._subscriptions.ElectronEnvPlatformRequest = subscription;
                })
                .catch((error: Error) => {
                    this._logger.warn(
                        `Fail to subscribe to render event "ElectronEnvPlatformRequest" due error: ${error.message}.`,
                    );
                }),
            this._ipc
                .subscribe(
                    IPCMessages.ElectronEnvShellOpenExternalRequest,
                    this._ipc_ElectronEnvShellOpenExternalRequest.bind(this),
                )
                .then((subscription: Subscription) => {
                    this._subscriptions.ElectronEnvShellOpenExternalRequest = subscription;
                })
                .catch((error: Error) => {
                    this._logger.warn(
                        `Fail to subscribe to render event "ElectronEnvShellOpenExternalRequest" due error: ${error.message}.`,
                    );
                }),
            this._ipc
                .subscribe(
                    IPCMessages.ElectronEnvShowOpenDialogRequest,
                    this._ipc_ElectronEnvShowOpenDialogRequest.bind(this),
                )
                .then((subscription: Subscription) => {
                    this._subscriptions.ElectronEnvShowOpenDialogRequest = subscription;
                })
                .catch((error: Error) => {
                    this._logger.warn(
                        `Fail to subscribe to render event "ElectronEnvShowOpenDialogRequest" due error: ${error.message}.`,
                    );
                }),
        ]).then(() => {
            return Promise.resolve(undefined);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            resolve();
        });
    }

    private _ipc_ElectronEnvPlatformRequest(
        message: IPCMessages.ElectronEnvPlatformRequest,
        response: (message: IPCMessages.ElectronEnvPlatformResponse) => Promise<void>,
    ) {
        response(
            new IPCMessages.ElectronEnvPlatformResponse({
                platform: process.platform,
            }),
        );
    }

    private _ipc_ElectronEnvShellOpenExternalRequest(
        message: IPCMessages.ElectronEnvShellOpenExternalRequest,
        response: (message: IPCMessages.ElectronEnvShellOpenExternalResponse) => Promise<void>,
    ) {
        shell
            .openExternal(message.url)
            .then(() => {
                response(new IPCMessages.ElectronEnvShellOpenExternalResponse({}));
            })
            .catch((err: Error) => {
                response(
                    new IPCMessages.ElectronEnvShellOpenExternalResponse({
                        error: this._logger.warn(
                            `Fail open external url "${message.url}" due error: ${err.message}`,
                        ),
                    }),
                );
            });
    }

    private _ipc_ElectronEnvShowOpenDialogRequest(
        message: IPCMessages.ElectronEnvShowOpenDialogRequest,
        response: (message: IPCMessages.ElectronEnvShowOpenDialogResponse) => Promise<void>,
    ) {
        dialog.showOpenDialog(this._window, message.options).then((result: OpenDialogReturnValue) => {
            response(new IPCMessages.ElectronEnvShowOpenDialogResponse({
                result: result,
            }));
        }).catch((err: Error) => {
            response(
                new IPCMessages.ElectronEnvShowOpenDialogResponse({
                    error: this._logger.warn(
                        `Fail open dialog (${JSON.stringify(message.options)}) due error: ${err.message}`,
                    ),
                }),
            );

        });
    }
}

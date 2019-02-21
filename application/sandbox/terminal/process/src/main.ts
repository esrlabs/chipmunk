import Logger from './env.logger';
import PluginIPCService from 'logviewer.plugin.ipc';
import { IPCMessages } from 'logviewer.plugin.ipc';
import Shell from './process.shell';
import * as EnvModule from './process.env';

class Plugin {

    private _logger: Logger = new Logger('Terminal');
    private _processShell: Shell | undefined;
    private _targetShell: string | undefined;
    private _availableShells: string[] = [];

    constructor() {
        PluginIPCService.subscribe(IPCMessages.PluginRenderMessage, this._onCommand.bind(this));
        this._onShellOutput = this._onShellOutput.bind(this);
        this._onShellClose = this._onShellClose.bind(this);
        this._getAvailableShells().then((shells: string[]) => {
            this._availableShells = shells;
            this._targetShell = this._availableShells[0];
            this.execute().catch((executeError: Error) => {
                this._logger.error(`Cannot execute defualt shell due error: ${executeError.message}`);
                return executeError;
            });
        }).catch((shellsListError: Error) => {
            this._targetShell = undefined;
            this._availableShells = [];
            this._logger.error(`Cannot get list of available shells due error: ${shellsListError.message}`);
            return shellsListError;
        });
    }

    public execute(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._targetShell === undefined) {
                return reject(new Error(this._logger.error(`Target shell isn't defined. Cannot start shell process.`)));
            }
            this._processShell = new Shell({ shell: 'bash' });
            this._processShell.on(Shell.Events.data, this._onShellOutput);
            this._processShell.on(Shell.Events.exit, this._onShellClose);
            resolve();
        });
    }

    private _getAvailableShells(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            EnvModule.shells().then((shells: string[]) => {
                if (!(shells instanceof Array) || shells.length === 0) {
                    return reject(new Error(this._logger.error(`Cannot detect available shells on OS level.`)));
                }
                resolve(shells);
            });
        });
    }

    private _onCommand(message: IPCMessages.PluginRenderMessage, response: (res: IPCMessages.TMessage) => any) {
        const command = message.data.command;
        console.log(message);
        switch (command) {
            case 'shell':
                if (this._processShell === undefined) {
                    return response(new IPCMessages.PluginError({
                        message: this._logger.error(`By some reasons shell process was killed. Cannot send command.`),
                        data: {
                            command: command
                        }
                    }));
                }
                return this._processShell.send(message.data.post).then(() => {
                    response(new IPCMessages.PluginRenderMessage({
                        data: {
                            status: 'done'
                        }
                    }));
                }).catch((error: Error) => {
                    response(new IPCMessages.PluginError({
                        message: this._logger.error(`Error sending data into shell due error: ${error.message}`),
                        data: {
                            command: command
                        }
                    }));
                });
            case 'availableShells':
                if (this._availableShells.length === 0) {
                    return response(new IPCMessages.PluginError({
                        message: this._logger.error(`No shells list is available.`),
                        data: {
                            command: command
                        }
                    }));
                }
                return response(new IPCMessages.PluginRenderMessage({
                    data: {
                        shells: this._availableShells
                    }
                }));
        }
    }

    private _onShellClose() {
        if (this._processShell === undefined) {
            return;
        }
        this._processShell.removeAllListeners();
        this._processShell = undefined;
    }

    private _onShellOutput(chunk: any) {
        const socket: any = PluginIPCService.getDataStream('test-socket');
        if (socket !== undefined) {
            socket.write(chunk, (error: Error) => {
                if (error) {
                    console.log(error);
                }
            });
        }
        PluginIPCService.sendToStream(chunk);
        PluginIPCService.sendToPluginHost(chunk.toString());
    }

}

const app: Plugin = new Plugin();

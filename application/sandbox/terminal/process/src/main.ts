import Logger from './env.logger';
import PluginIPCService from './plugin.ipc.service';
import { IPCMessage } from './plugin.ipc.service';
import Shell from './process.shell';
import * as EnvModule from './process.env';

class Plugin {

    private _logger: Logger = new Logger('Terminal');
    private _processShell: Shell | undefined;
    private _targetShell: string | undefined;
    private _availableShells: string[] = [];

    constructor() {
        PluginIPCService.on(PluginIPCService.Events.message, this._onCommand.bind(this));
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

    private _onCommand(message: IPCMessage) {
        switch (message.command) {
            case 'shell':
                if (this._processShell === undefined) {
                    return PluginIPCService.send(new IPCMessage({
                        command: message.command,
                        data: {
                            error: this._logger.error(`By some reasons shell process was killed. Cannot send command.`),
                        },
                        sequence: message.sequence
                    }));
                }
                return this._processShell.send(message.data).then(() => {
                    PluginIPCService.send(new IPCMessage({
                        command: message.command,
                        data: {},
                        sequence: message.sequence
                    }));
                }).catch((error: Error) => {
                    PluginIPCService.send(new IPCMessage({
                        command: message.command,
                        data: {
                            error: this._logger.error(`Error sending data into shell due error: ${error.message}`),
                        },
                        sequence: message.sequence
                    }));
                });
            case 'availableShells':
                if (this._availableShells.length === 0) {
                    return PluginIPCService.send(new IPCMessage({
                        command: message.command,
                        data: {
                            error: this._logger.error(`No shells list is available.`),
                        },
                        sequence: message.sequence
                    }));
                }
                return PluginIPCService.send(new IPCMessage({
                    command: message.command,
                    data: {
                        shells: this._availableShells
                    },
                    sequence: message.sequence
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
        PluginIPCService.sendToStream(chunk);
    }

}

const app: Plugin = new Plugin();

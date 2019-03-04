import Logger from './env.logger';
import PluginIPCService from 'logviewer.plugin.ipc';
import { IPCMessages } from 'logviewer.plugin.ipc';
import Shell from './process.shell';
import * as EnvModule from './process.env';

interface IStreamInfo {
    shell: Shell;
    target: string;
}

class Plugin {

    private _logger: Logger = new Logger('Terminal');
    private _availableShells: string[] = [];
    private _streams: Map<string, IStreamInfo> = new Map();

    constructor() {
        this._onCommand = this._onCommand.bind(this);
        this._onOpenStream = this._onOpenStream.bind(this);
        this._onCloseStream = this._onCloseStream.bind(this);
        PluginIPCService.subscribe(IPCMessages.PluginInternalMessage, this._onCommand);
        PluginIPCService.on(PluginIPCService.Events.openStream, this._onOpenStream);
        PluginIPCService.on(PluginIPCService.Events.closeStream, this._onCloseStream);
    }

    public execute(streamId: string, target: string): Promise<Shell> {
        return new Promise((resolve, reject) => {
            const shell: Shell = new Shell({ shell: target }); 
            shell.on(Shell.Events.data, this._onShellOutput.bind(this, streamId));
            shell.on(Shell.Events.exit, this._onShellClose.bind(this, streamId));
            resolve(shell);
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

    private _onCommand(message: IPCMessages.PluginInternalMessage, response: (res: IPCMessages.TMessage) => any) {
        console.log(message);
        switch (message.data.command) {
            case 'shell':
                if (message.stream === undefined) {
                    return response(new IPCMessages.PluginError({
                        message: this._logger.error(`Target stream isn't defined`),
                        data: {
                            command: message.data.command
                        }
                    }));
                }
                const stream: IStreamInfo | undefined = this._streams.get(message.stream);
                if (stream === undefined) {
                    return response(new IPCMessages.PluginError({
                        message: this._logger.error(`Fail to find a stream "${message.stream}" in storage.`),
                        data: {
                            command: message.data.command
                        }
                    }));
                }
                return stream.shell.send(message.data.post).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    response(new IPCMessages.PluginError({
                        message: this._logger.error(`Error sending data (stream "${message.stream}") into shell due error: ${error.message}`),
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case 'availableShells':
                if (this._availableShells.length === 0) {
                    return response(new IPCMessages.PluginError({
                        message: this._logger.error(`No shells list is available.`),
                        data: {
                            command: message.data.command
                        }
                    }));
                }
                return response(new IPCMessages.PluginInternalMessage({
                    data: {
                        shells: this._availableShells
                    },
                    token: message.token
                }));
        }
    }

    private _onShellClose(streamId: string) {
        const stream: IStreamInfo | undefined = this._streams.get(streamId);
        if (stream === undefined) {
            this._logger.warn(`Attempt to close stream "${streamId}", which doesn't exists.`);
            return;
        }
        stream.shell.removeAllListeners();
        this._streams.delete(streamId);
    }

    private _onShellOutput(streamId: string, chunk: any) {
        PluginIPCService.sendToStream(chunk, streamId);
        // PluginIPCService.sendToPluginHost(chunk.toString());
    }

    private _onOpenStream(streamId: string) {
        this._getAvailableShells().then((shells: string[]) => {
            this._availableShells = shells;
            this.execute(streamId, this._availableShells[0]).then((shell: Shell) => {
                this._streams.set(streamId, {
                    shell: shell,
                    target: this._availableShells[0]
                });
            }).catch((executeError: Error) => {
                this._logger.error(`Cannot execute shell for stream ${streamId} due error: ${executeError.message}`);
                return executeError;
            });
        }).catch((shellsListError: Error) => {
            this._availableShells = [];
            this._logger.error(`Cannot get list of available shells due error: ${shellsListError.message}`);
            return shellsListError;
        });
    }

    private _onCloseStream(streamId: string) {

    }

}

const app: Plugin = new Plugin();

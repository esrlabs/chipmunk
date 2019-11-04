import Logger from './env.logger';
import * as path from 'path';
import PluginIPCService from 'chipmunk.plugin.ipc';
import { IPCMessages } from 'chipmunk.plugin.ipc';
import StreamsService, { IStreamInfo } from './service.streams';
import { IForkSettings } from './process.fork';

class Plugin {

    private _logger: Logger = new Logger('Processes');

    constructor() {
        this._onStreamOpened = this._onStreamOpened.bind(this);
        this._onStreamClosed = this._onStreamClosed.bind(this);
        this._onIncomeRenderIPCMessage = this._onIncomeRenderIPCMessage.bind(this);
        PluginIPCService.subscribe(IPCMessages.PluginInternalMessage, this._onIncomeRenderIPCMessage);
        StreamsService.on(StreamsService.Events.onStreamOpened, this._onStreamOpened);
        StreamsService.on(StreamsService.Events.onStreamClosed, this._onStreamClosed);
    }

    /*
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
    */

    private _onIncomeRenderIPCMessage(message: IPCMessages.PluginInternalMessage, response: (res: IPCMessages.TMessage) => any) {
        switch (message.data.command) {
            case 'command':
                return this._income_command(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    return response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case 'stop':
                return this._income_stop(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    return response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case 'write':
                return this._income_write(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    return response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case 'getSettings':
                return this._income_getSettings(message).then((settings: IForkSettings) => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            settings: settings
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    return response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            default:
                this._logger.warn(`Unknown commad: ${message.data.command}`);
        }
    }

    private _income_command(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            // Get a target stream
            const stream: IStreamInfo | undefined = StreamsService.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Fail to find a stream "${streamId}" in storage.`)));
            }
            const cmd: string | undefined = message.data.cmd;
            if (typeof cmd !== 'string') {
                return reject(new Error(this._logger.warn(`Fail to execute command for a stream "${streamId}" because command isn't a string, but ${typeof cmd}.`)));
            }
            // Check: is it "cd" command. If yes, change cwd of settings and resolve
            const cd: boolean | Error = this._cwdChange(cmd, stream);
            if (cd === true) {
                return resolve();
            } else if (cd instanceof Error) {
                return reject(cd);
            }
            // Ref fork to stream
            StreamsService.refFork(streamId, cmd);
            resolve();            
        });
    }

    private _income_stop(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            // Get a target stream
            const stream: IStreamInfo | undefined = StreamsService.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Fail to find a stream "${streamId}" in storage.`)));
            }
            // Ref fork to stream
            StreamsService.unrefFork(streamId);
            resolve();            
        });
    }

    private _income_write(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            // Get a target stream
            const stream: IStreamInfo | undefined = StreamsService.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Fail to find a stream "${streamId}" in storage.`)));
            }
            const input: any = message.data.input;
            if (input === undefined) {
                return reject(new Error(this._logger.warn(`Fail to write into stream "${streamId}" because input is undefined.`)));
            }
            // Check: is fork still running
            if (stream.fork === undefined || stream.fork.isClosed()) {
                return reject(new Error(this._logger.warn(`Fail to write into stream "${streamId}" because fork is closed.`)));
            }
            // Write data
            stream.fork.write(input).then(resolve).catch(reject);
        });
    }

    private _income_getSettings(message: IPCMessages.PluginInternalMessage): Promise<IForkSettings> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            // Get a target stream
            const stream: IStreamInfo | undefined = StreamsService.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Fail to find a stream "${streamId}" in storage.`)));
            }
            resolve(stream.settings);            
        });
    }

    private _cwdChange(command: string, stream: IStreamInfo): boolean | Error {
        const cdCmdReg = /^cd\s*([^\s]*)/gi;
        const match: RegExpExecArray | null = cdCmdReg.exec(command.trim());
        if (match === null) {
            return false;
        }
        if (match.length !== 2) {
            return false;
        }
        try {
            stream.settings.cwd = path.resolve(stream.settings.cwd, match[1]);
        } catch (e) {
            this._logger.error(`Fail to make "cd" due error: ${e.message}`);
            return e;
        }
        StreamsService.updateSettings(stream.streamId, stream.settings);
        return true;
    }

    private _onStreamOpened(streamId: string) {
        // Get a target stream
        const stream: IStreamInfo | undefined = StreamsService.get(streamId);
        if (stream === undefined) {
            return this._logger.warn(`Event "onStreamOpened" was triggered, but fail to find a stream "${streamId}" in storage.`);
        }
        const error: Error | undefined = StreamsService.updateSettings(stream.streamId);
        if (error instanceof Error) {
            return this._logger.warn(`Event "onStreamOpened" was triggered, but fail to notify host due error: ${error.message}.`);
        }
    }

    private _onStreamClosed(streamId: string) {

    }

}

const app: Plugin = new Plugin();

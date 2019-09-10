import Logger from './env.logger';
import * as path from 'path';
import { IPCMessages } from 'logviewer.plugin.ipc';
import StreamsService, { IStreamInfo, IStreamState } from './service.streams';
import { IForkSettings } from './process.fork';
import CommunicationsService from './communication.streams';

class Plugin {

    private _logger: Logger = new Logger('Processes');

    constructor() {
        this._onStreamClosed = this._onStreamClosed.bind(this);
        this._onStreamOpened = this._onStreamOpened.bind(this);

        CommunicationsService.on(CommunicationsService.Resolve.onOpenStream, this._onStreamOpened);
        CommunicationsService.on(CommunicationsService.Resolve.onCloseStream, this._onStreamClosed);

        this._onRequestStop = this._onRequestStop.bind(this);
        this._onRequestWrite = this._onRequestWrite.bind(this);
        this._onRequestCommand = this._onRequestCommand.bind(this);
        this._onRequestSettings = this._onRequestSettings.bind(this);

        CommunicationsService.on(CommunicationsService.Request.onStop, this._onRequestStop);
        CommunicationsService.on(CommunicationsService.Request.onWrite, this._onRequestWrite);
        CommunicationsService.on(CommunicationsService.Request.onCommand, this._onRequestCommand);
        CommunicationsService.on(CommunicationsService.Request.onSettings, this._onRequestSettings);
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

    private _onRequestCommand(
        message: IPCMessages.PluginInternalMessage,
        response: (res: IPCMessages.TMessage) => any): void {

        new Promise((resolve) => {
            this._incoming_command(message).then(() => {
                resolve({ error: undefined });
            }).catch((error: Error) => {
                resolve({ error: error.message });
            });
        }).then((result) => {
            CommunicationsService.emit(
                CommunicationsService.Resolve.onCommand, message, result, response);
        });
    }

    private _onRequestStop(
        message: IPCMessages.PluginInternalMessage,
        response: (res: IPCMessages.TMessage) => any): void {

        new Promise((resolve) => {
            this._income_stop(message).then(() => {
                resolve({ error: undefined });
            }).catch((error: Error) => {
                resolve({ error: error.message });
            });
        }).then((result) => {
            CommunicationsService.emit(
                CommunicationsService.Resolve.onStop, message, result, response);
        });
    }

    private _onRequestWrite(
        message: IPCMessages.PluginInternalMessage,
        response: (res: IPCMessages.TMessage) => any): void {

        new Promise((resolve) => {
            this._income_write(message).then(() => {
                resolve({ error: undefined });
            }).catch((error: Error) => {
                resolve({ error: error.message });
            });
        }).then((result) => {
            CommunicationsService.emit(
                CommunicationsService.Resolve.onWrite, message, result, response);
        });
    }

    private _onRequestSettings(
        message: IPCMessages.PluginInternalMessage,
        response: (res: IPCMessages.TMessage) => any): void {

        new Promise((resolve) => {
            this._income_getSettings(message).then((settings) => {
                resolve({
                    error: undefined,
                    settings: settings,
                });
            }).catch((error: Error) => {
                resolve({ error: error.message });
            });
        }).then((result) => {
            CommunicationsService.emit(
                CommunicationsService.Resolve.onSettings, message, result, response);
        });
    }

    private _incoming_command(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream-ID provided.`)));
            }
            // Get a target stream
            const stream: IStreamInfo | undefined = StreamsService.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Failed to find stored stream with id="${streamId}".`)));
            }
            if (stream.state !== IStreamState.Ready) {
                return reject(new Error(this._logger.warn(`Stream "${streamId}" is not yet ready for tasks.`)));
            }

            const cmd: string | undefined = message.data.cmd;
            if (typeof cmd !== 'string') {
                return reject(new Error(this._logger.warn(`Failed to execute command for stream "${streamId}". Reason: command isn't a string, but of type ${typeof cmd}.`)));
            }
            // Check: is it "cd" command. If yes, change cwd of settings and resolve
            const cd: boolean | Error = this._cwdChange(cmd, stream);
            if (cd === true) {
                // CommunicationsService.emit(CommunicationsService.Events.onForkClosed, streamId, message.data.id);
                return resolve();
            } else if (cd instanceof Error) {
                // CommunicationsService.emit(CommunicationsService.Events.onForkClosed, streamId, message.data.id);
                return reject(cd);
            }
            // Ref fork to stream
            const error: Error | undefined = StreamsService.refFork(streamId, cmd, message.data.id);
            return error !== undefined ? reject(error) : resolve();
        });
    }

    private _income_stop(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream-ID provided`)));
            }
            // Get a target stream
            const stream: IStreamInfo | undefined = StreamsService.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Failed to find stored stream with id="${streamId}".`)));
            }
            if (stream.state !== IStreamState.Ready) {
                return reject(new Error(this._logger.warn(`Stream "${streamId}" is not yet ready for tasks.`)));
            }

            // Ref fork to stream
            const error: Error | undefined = StreamsService.unrefFork(streamId, message.data.id);
            return error !== undefined ? reject(error) : resolve();
        });
    }

    private _income_write(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream-ID provided`)));
            }
            // Get a target stream
            const stream: IStreamInfo | undefined = StreamsService.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Failed to find stored stream with id="${streamId}".`)));
            }
            if (stream.state !== IStreamState.Ready) {
                return reject(new Error(this._logger.warn(`Stream "${streamId}" is not yet ready for tasks.`)));
            }

            const input: any = message.data.input;
            if (input === undefined) {
                return reject(new Error(this._logger.warn(`Failed to write to stream "${streamId}". Reason: input is undefined.`)));
            }

            // Check if fork is still running
            const process = stream.forks.get(message.data.id);
            if (process === undefined || process.isClosed()) {
                return reject(new Error(this._logger.warn(`Failed to write to process "${streamId}". Reason: fork "${message.data.id}" is closed.`)));
            }
            // Write data
            process.write(input).then(resolve).catch(reject);
        });
    }

    private _income_getSettings(message: IPCMessages.PluginInternalMessage): Promise<IForkSettings> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream-ID provided`)));
            }
            // Get a target stream
            const stream: IStreamInfo | undefined = StreamsService.get(streamId);
            if (stream === undefined) {
                return reject(new Error(this._logger.warn(`Failed to find stored stream with id="${streamId}".`)));
            }
            if (stream.state !== IStreamState.Ready) {
                return reject(new Error(this._logger.warn(`Stream "${streamId}" is not yet ready for tasks.`)));
            }

            resolve(stream.settings);
        });
    }

    private _cwdChange(command: string, stream: IStreamInfo): boolean | Error {
        const cdCmdReg = /^cd\s*([^\s]*)/gi;
        const match: RegExpExecArray | null = cdCmdReg.exec(command.trim());
        if (match === null || match.length !== 2) {
            return false;
        }

        if (stream.settings === undefined) {
            return new Error(`Settings of stream "${stream.streamId}" are undefined.`);
        }

        try {
            // CommunicationsService.emit(CommunicationsService.Events.onForkStarted, streamId, commandId);
            stream.settings.cwd = path.resolve(stream.settings.cwd, match[1]);
            // CommunicationsService.emit(CommunicationsService.Events.onForkClosed, streamId, commandId);
        } catch (e) {
            this._logger.error(`Failed to change directory due to an error: ${e.message}`);
            return e;
        }
        const error: Error | undefined = StreamsService.updateSettings(stream.streamId, stream.settings);
        return error !== undefined;
    }

    private _onStreamOpened(streamId: string): string | undefined {
        // Get a target stream
        const stream: IStreamInfo | undefined = StreamsService.get(streamId);
        if (stream === undefined) {
            return this._logger.warn(`Event "onStreamOpened" was triggered, but failed to find stored stream with id="${streamId}".`);
        }
        const error: Error | undefined = StreamsService.updateSettings(stream.streamId);
        if (error instanceof Error) {
            return this._logger.warn(`Event "onStreamOpened" was triggered, but failed to notify host due to error: ${error.message}.`);
        }
    }

    private _onStreamClosed(streamId: string): void {
        //
    }

}

const app: Plugin = new Plugin();

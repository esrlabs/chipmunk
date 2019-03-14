import Logger from './env.logger';
import * as fs from 'fs';
import PluginIPCService from 'logviewer.plugin.ipc';
import { IPCMessages } from 'logviewer.plugin.ipc';

class Plugin {

    private _logger: Logger = new Logger('XTerminal');
    private _session: string | undefined;
    private _stream: fs.ReadStream | undefined;
    private _file: string | undefined;

    constructor() {
        this._onIncomeRenderIPCMessage = this._onIncomeRenderIPCMessage.bind(this);
        PluginIPCService.subscribe(IPCMessages.PluginInternalMessage, this._onIncomeRenderIPCMessage);
    }

    private _onIncomeRenderIPCMessage(message: IPCMessages.PluginInternalMessage, response: (res: IPCMessages.TMessage) => any) {
        // Process commands
        switch (message.data.command) {
            case 'open':
                return this._income_open(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'xterminal-created'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    return response(new IPCMessages.PluginError({
                        message: error.message,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case 'stop': 
                return this._income_stop(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'sent'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    return response(new IPCMessages.PluginError({
                        message: error.message,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            default:
                this._logger.warn(`Unknown commad: ${message.data.event}`);
        }
    }

    private _income_open(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._stream !== undefined) {
                return reject(new Error(`Cannot open file, because current "${this._file}" is still reading.`));
            }
            const file: string = message.data.file;
            if (typeof file !== 'string' || !fs.existsSync(file)) {
                return reject(new Error(`File "${file}" doesn't exist.`));
            }
            const streamId: string = message.data.streamId;
            fs.stat(file, (error: NodeJS.ErrnoException, stats: fs.Stats) => {
                if (error) {
                    return reject(new Error(`Fail to open file "${file}" due error: ${error.message}`));
                }
                const done = () => {
                    PluginIPCService.sendToPluginHost({
                        event: 'finished',
                        streamId: streamId,
                        file: file,
                        duration: Date.now() - started
                    });
                    stream.close();
                    this._stream = undefined;
                    this._file = undefined;
                    this._session = undefined;
                };
                const started: number = Date.now();
                // Notify client: reading is started
                PluginIPCService.sendToPluginHost({
                    event: 'started',
                    streamId: streamId,
                    file: file,
                    size: stats.size
                });
                // Create stream to read a target file
                const stream = fs.createReadStream(file);
                stream.on('data', (chunk: any) => {
                    console.log(`Send: ${chunk.length}`);
                    PluginIPCService.sendToStream(chunk, streamId);
                    PluginIPCService.sendToPluginHost({
                        event: 'state',
                        streamId: streamId,
                        file: file,
                        read: stream.bytesRead
                    });
                    if (stream.bytesRead === stats.size) {
                        // Whole file is read. If stream still is available - event "end" wasn't triggered.
                        done();
                    }
                });
                stream.on('end', () => {
                    if (this._stream === undefined) {
                        return;
                    }
                    done();
                });
                // Save data
                this._file = file;
                this._session = streamId;
                this._stream = stream;
                // Resolve
                resolve();           
            });
        });
    }

    private _income_stop(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._stream === undefined) {
                return resolve();
            }
            this._stream.close();
            this._stream = undefined;
            this._file = undefined;
            this._session = undefined;
            resolve();           
        });
    }

}

const app: Plugin = new Plugin();

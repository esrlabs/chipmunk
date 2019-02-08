import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { IMessage, IPCMessage } from './controller.plugin.process.ipc.message';

import Logger from '../../platform/node/src/env.logger';

export { IPCMessage, IMessage };

export default class ControllerIPCPlugin extends EventEmitter {

    public static Events = {
        message: 'message',
        stream: 'stream',
    };

    public Events = ControllerIPCPlugin.Events;

    private _logger: Logger;
    private _pluginName: string;
    private _stream: Readable;
    private _process: ChildProcess;
    private _pending: Map<string, (message: IPCMessage) => any> = new Map();

    constructor(pluginName: string, process: ChildProcess, stream: Readable) {
        super();
        this._pluginName = pluginName;
        this._stream = stream;
        this._process = process;
        this._logger = new Logger(`plugin IPC: ${this._pluginName}`);
        this._process.on('message', this._onMessage.bind(this));
        this._stream.on('data', this._onStream.bind(this));
    }

    /**
     * Sends message to plugin process via IPC without expecting any answer
     * @param {IPCMessage} data package of data
     * @returns { Promise<void> }
     */
    public send(message: IPCMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            this._send(message).then(() => {
                resolve();
            }).catch(reject);
        });
    }

    /**
     * Sends message to plugin process via IPC and waiting for a answer
     * @param {IPCMessage} data package of data
     * @returns { Promise<IPCMessage> }
     */
    public request(message: IPCMessage): Promise<IPCMessage> {
        return new Promise((resolve, reject) => {
            this._send(message, true).then((response: IPCMessage | undefined) => {
                if (!(response instanceof IPCMessage)) {
                    return reject(new Error(`Has gotten not expected answer format. Expecting IPCMessage. Has gotten: ${typeof response}`));
                }
                resolve(response);
            }).catch(reject);
        });
    }

    public destroy(): void {
        this._process.removeAllListeners('message');
        this._stream.removeAllListeners('data');
        this._pending.clear();
    }

    /**
     * Sends message to plugin process via IPC
     * @param {IPCMessage} data package of data
     * @param {boolean} expectResponse  true - promise will be resolved with income message with same "sequence";
     *                                  false (default) - promise will be resolved afte message be sent
     * @returns { Promise<IPCMessage | undefined> }
     */
    private _send(message: IPCMessage, expectResponse: boolean = false): Promise<IPCMessage | undefined> {
        return new Promise((resolve, reject) => {
            if (!this._process.send) {
                return reject(new Error(this._logger.error(`IPC isn't available`)));
            }
            if (!(message instanceof IPCMessage)) {
                return reject(new Error(this._logger.error(`Expecting as message instance of IPCMessage`)));
            }
            if (expectResponse) {
                this._pending.set(message.sequence, resolve);
            }
            this._process.send(message, (error: Error) => {
                if (error) {
                    this._logger.warn(`Error while sending message to plugin: ${error.message}`);
                    return reject(error);
                }
                if (!expectResponse) {
                    return resolve();
                }
            });
        });
    }

    /**
     * Handler of incoming message from plugin process
     * @returns void
     */
    private _onMessage(data: any) {
        try {
            const message: IPCMessage = new IPCMessage(data);
            const resolver = this._pending.get(message.sequence);
            if (resolver !== undefined) {
                this._pending.delete(message.sequence);
                resolver(message);
            } else {
                this.emit(ControllerIPCPlugin.Events.message, message);
            }
        } catch (e) {
            this._logger.error(`Incorrect format of IPC message: ${typeof data}. Error: ${e.message}`);
        }
    }

    /**
     * Handler of incoming stream from plugin process
     * @returns void
     */
    private _onStream(chunk: any): void {
        this.emit(ControllerIPCPlugin.Events.stream, chunk);
    }

}

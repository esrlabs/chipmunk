import * as Net from 'net';
import * as Stream from 'stream';
import { EventEmitter } from 'events';
import { IMessagePackage, IPCMessagePackage } from './plugin.ipc.service.message';
import Subscription, { THandler } from './tools.subscription';
import * as IPCMessages from '../../../common/ipc/plugins.ipc.messages/index';
import guid from './tools.guid';

export { IPCMessages };

export interface IStreamInfo {
    id: string;
    file: string;
    socket: Net.Socket | undefined;
}

export interface IPipedStreamInfo {
    size: number;
    name: string;
}

export const CStdoutSocketAliases = {
    bind: '[socket]:',
    unbind: '[socket_unbind]:',
};

/**
 * @class PluginIPCService
 * @description Service provides communition between plugin's process and parent (main) process
 * @notes Parent (main) process attach plugin's process as fork with next FDs:
 *      { fd: 0 } stdin     doesn't used by parent process
 *      { fd: 1 } stdout    listened by parent process. Whole output from it goes to logs of parent process
 *      { fd: 2 } stderr    listened by parent process. Whole output from it goes to logs of parent process
 *      { fd: 3 } ipc       used by parent process as command sender / reciever
 * @recommendations
 *      - to parse logs use simple "console.log (warn, err etc)" or you can write it directly to stdout
 *      - parent process nothig send to process.stdin ( fd: 0 )
 *      - ipc channel ({ fd: 3 }) are using to exchange commands, but not data. Data should be send via stream
 *      - pipe channel ({ fd: 4 }) are using to send stream's data to parent. In only in one way: plugin -> parent.
 *        To work with this channel WriteStream is created. Developer are able:
 *        a) use method of this service "sendToStream" to send chunk of data
 *        b) get stream using "getDataStream" and pipe it with source of data
 *      - use event "message" to get commands from parent process
 *      - plugin process doesn't have direct access to render process; communication via render and main process
 *        goes via main process: [plugin -> main (parent) -> render] and [render -> main (parent) -> plugin]
 */
export class PluginIPCService extends EventEmitter {

    private _pending: Map<string, (message: IPCMessages.TMessage) => any> = new Map();
    private _subscriptions: Map<string, Subscription> = new Map();
    private _handlers: Map<string, Map<string, THandler>> = new Map();
    private _token: string | undefined;
    private _id: number | undefined;
    private _tokenSubscription: Subscription | undefined;
    private _sockets: Map<string, Net.Socket> = new Map();

    public static Events = {
        close: 'close',
        closeStream: 'closeStream',
        openStream: 'openStream',
    };

    public Events = PluginIPCService.Events;

    constructor() {
        super();
        // Check IPC (to communicate with parent process)
        if (process.send === void 0) {
            throw new Error(`Fail to init plugin, because IPC interface isn't available. Expecting 'ipc' on "fd:3"`);
        }
        // Listen parent process for messages
        process.on('message', this._onMessage.bind(this));
        // Subscribe to token message
        this.subscribe(IPCMessages.PluginToken, this._onPluginToken.bind(this)).then((subscription: Subscription) => {
            this._tokenSubscription = subscription;
        }).catch((subscribeError: Error) => {
            console.log(`Fail to subscribe "IPCMessages.PluginToken" due error: ${subscribeError.message}`);
        });
    }

    public sendToPluginHost(session: string, message: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this._token === undefined) {
                return reject(new Error(`Fail to send to plugin host because token wasn't gotten.`));
            }
            const pluginMessage: IPCMessages.PluginInternalMessage = new IPCMessages.PluginInternalMessage({
                data: message,
                stream: session,
                token: this._token,
            });
            this.send(pluginMessage).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public requestToPluginHost(session: string, message: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this._token === undefined) {
                return reject(new Error(`Fail to send to plugin host because token wasn't gotten.`));
            }
            const pluginMessage: IPCMessages.PluginInternalMessage = new IPCMessages.PluginInternalMessage({
                data: message,
                stream: session,
                token: this._token,
            });
            this.request(pluginMessage).then((response: IPCMessages.TMessage | undefined) => {
                if (!(response instanceof IPCMessages.PluginInternalMessage)) {
                    return reject(new Error(`From plugin host was gotten incorrect responce: ${typeof response}/${response}`));
                }
                resolve(response.data);
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    /**
     * Sends message to parent (main) process via IPC without expecting any answer
     * @param {IPCMessages.TMessage} data package of data
     * @returns { Promise<void> }
     */
    public send(message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: message,
                token: this._token !== undefined ? this._token : null,
            });
            this._send(messagePackage).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public response(sequence: string, message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: message,
                sequence: sequence,
                token: this._token !== undefined ? this._token : null,
            });
            this._send(messagePackage).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    /**
     * Sends message to parent (main) process via IPC and waiting for a answer
     * @param {IPCMessages.TMessage} data package of data
     * @returns { Promise<IPCMessages.TMessage | undefined> }
     */
    public request(message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: message,
                token: this._token !== undefined ? this._token : null,
            });
            this._send(messagePackage, true).then((response: IPCMessages.TMessage | undefined) => {
                resolve(response);
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public subscribe(message: Function, handler: THandler): Promise<Subscription> {
        return new Promise((resolve, reject) => {
            if (!this._isValidMessageClassRef(message)) {
                return reject(new Error(`Incorrect reference to message class.`));
            }

            const signature: string = (message as any).signature;
            const subscriptionId: string = guid();
            let handlers: Map<string, THandler> | undefined = this._handlers.get(signature);
            if (handlers === undefined) {
                handlers = new Map();
            }
            handlers.set(subscriptionId, handler);
            this._handlers.set(signature, handlers);
            const subscription: Subscription = new Subscription(signature, () => {
                this._unsubscribe(signature, subscriptionId);
            }, subscriptionId);
            this._subscriptions.set(subscriptionId, subscription);
            resolve(subscription);
        });
    }

    /**
     * Sends chunk of data to data's stream
     * @param {any} chunk package of data
     * @param {string} streamId id of target stream
     * @returns { Promise<void> }
     */
    public sendToStream(chunk: Buffer, streamId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!(chunk instanceof Buffer)) {
                return reject(new Error(`"chunk" should be a Buffer.`));
            }
            const socket: Net.Socket | undefined = this._getStreamSocket(streamId);
            if (socket === undefined) {
                return reject(new Error(`Fail to find bound socket with stream "${streamId}".`));
            }
            // Send data
            socket.write(chunk, (error: Error) => {
                if (error) {
                    console.log(`Fail to send data due error: ${error.message}`);
                    // return reject(error);
                }
                resolve();
            });
        });
    }

    /**
     * Pipe readable stream with session stream.
     * @returns { Error | undefined } returns errors if stream isn't found
     */
    public pipeWithStream(readStream: Stream.Readable, info: IPipedStreamInfo, streamId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket: Net.Socket | undefined = this._getStreamSocket(streamId);
            if (socket === undefined) {
                return reject(new Error(`Fail to find bound socket with stream "${streamId}".`));
            }
            const pipeId: string = guid();
            // Send message about streaming
            this.send(new IPCMessages.SessionStreamPipeStarted({
                name: info.name,
                pipeId: pipeId,
                size: info.size,
                streamId: streamId,
            }));
            readStream.pipe(socket, { end: false });
            readStream.on('end', () => {
                // Notify main process: reading is finished
                this.send(new IPCMessages.SessionStreamPipeFinished({
                    pipeId: pipeId,
                    streamId: streamId,
                }));
                // Resolve
                resolve();
            });
        });
    }

    /**
     * Returns write stream. Can be used to pipe write stream with source of data
     * @returns { Net.Socket }
     */
    private _getStreamSocket(streamId: string): Net.Socket | undefined {
        return this._sockets.get(streamId);
    }

    /**
     * Sends message to parent (main) process via IPC
     * @param {IPCMessage} data package of data
     * @param {boolean} expectResponse  true - promise will be resolved with income message with same "sequence";
     *                                  false (default) - promise will be resolved afte message be sent
     * @returns { Promise<IPCMessage | undefined> }
     */
    private _send(message: IPCMessagePackage, expectResponse: boolean = false): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            if (!process.send) {
                return reject(new Error(`IPC isn't available`));
            }
            if (!(message instanceof IPCMessagePackage)) {
                return reject(new Error(`Expecting as message instance of IPCMessagePackage`));
            }
            if (expectResponse) {
                this._pending.set(message.sequence, resolve);
            }
            process.send(message, (error: Error) => {
                if (error) {
                    return reject(error);
                }
                if (!expectResponse) {
                    return resolve();
                }
            });
        });
    }

    /**
     * Handler of incoming message from parent (main) process
     * @returns void
     */
    private _onMessage(data: any, socket?: Net.Socket) {
        try {
            // Check socket before
            if (typeof data === 'string') {
                if (data.indexOf(CStdoutSocketAliases.bind) === 0) {
                    if (socket === undefined && process.platform !== 'win32') {
                        return console.error(`Has gotten socket information "${data}", but handle to socket is undefined. Platform: ${process.platform}`);
                    }
                    const parts: string[] = data.replace(CStdoutSocketAliases.bind, '').split(';');
                    if (parts.length !== 2) {
                        return console.error(`Has gotten socket information "${data}", but there error with extracting stream ID and filename of socket.`);
                    }
                    const info: IStreamInfo = { id: parts[0], file: parts[1], socket: socket };
                    return this._acceptSocket(info);
                } else if (data.indexOf(CStdoutSocketAliases.unbind) === 0) {
                    const streamId: string = data.replace(CStdoutSocketAliases.unbind, '');
                    if (streamId.trim() === '') {
                        return console.error(`Has gotten unbind socket information "${data}", but there error with extracting stream ID.`);
                    }
                    return this._removeSocket(streamId);
                }
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage(data);
            if (this._token !== undefined && messagePackage.token !== null && messagePackage.token !== this._token) {
                // This message isn't for this instance of IPC
                return;
            }
            const resolver = this._pending.get(messagePackage.sequence);
            this._pending.delete(messagePackage.sequence);
            const refMessageClass = this._getRefToMessageClass(messagePackage.message);
            if (refMessageClass === undefined) {
                throw new Error(`Cannot find ref to class of message`);
            }
            const instance: IPCMessages.TMessage = new (refMessageClass as any)(messagePackage.message);
            if (resolver !== undefined) {
                return resolver(instance);
            }
            const handlers = this._handlers.get(instance.signature);
            if (handlers === undefined) {
                return;
            }
            handlers.forEach((handler: THandler) => {
                handler(instance, this.response.bind(this, messagePackage.sequence));
            });
        } catch (e) {
            console.log(`Incorrect format of IPC message: ${typeof data}. Error: ${e.message}`);
        }
    }

    private _acceptSocket(stream: IStreamInfo) {
        if (process.platform === 'win32') {
            const socket: Net.Socket = Net.connect(stream.file, () => {
                // Save socket
                this._sockets.set(stream.id, socket);
                // Send signature
                console.log(`Socket connection is created on plugin level. Will send signature (plugin ID: ${this._id}; token: ${this._token})`);
                socket.write(`[plugin:${this._id}]`, (error: Error) => {
                    if (error) {
                        return console.log(`Cannot send ID of plugin into socket due error: ${error.message}`);
                    }
                    console.log(`ID of plugin was sent to main process.`);
                });
                console.log(`Created new connection UNIX socket: ${stream.file} for plugin stream "${stream.id}".`);
            });
        } else if (stream.socket !== undefined) {
            this._sockets.set(stream.id, stream.socket);
            console.log(`Accepted socket of stream "${stream.id}"`);
        }
        // Notify listeners.
        this.emit(this.Events.openStream, stream.id);
        // Notify host
        this._send(new IPCMessagePackage({
            message: new IPCMessages.SessionStreamBound({
                streamId: stream.id,
            }),
        }), false);
    }

    private _removeSocket(streamId: string) {
        this._sockets.delete(streamId);
        // Notify listeners.
        this.emit(this.Events.closeStream, streamId);
        // Notify host
        this._send(new IPCMessagePackage({
            message: new IPCMessages.SessionStreamUnbound({
                streamId: streamId,
            }),
        }), false);
        console.log(`Socket of stream "${streamId}" is unbound from plugin`);
    }

    // TODO: Removing (closing) stream. Without it single mode will not work as should

    private _getRefToMessageClass(message: IPCMessages.TMessage): Function | undefined {
        let ref: Function | undefined;
        Object.keys(IPCMessages.Map).forEach((alias: string) => {
            if (ref) {
                return;
            }
            if (message instanceof (IPCMessages.Map as any)[alias] || message.signature === (IPCMessages.Map as any)[alias].signature) {
                ref = (IPCMessages.Map as any)[alias];
            }
        });
        return ref;
    }

    private _isValidMessageClassRef(messageRef: Function): boolean {
        let result: boolean = false;
        if (typeof (messageRef as any).signature !== 'string' || (messageRef as any).signature.trim() === '') {
            return false;
        }
        Object.keys(IPCMessages.Map).forEach((alias: string) => {
            if (result) {
                return;
            }
            if ((messageRef as any).signature === (IPCMessages.Map as any)[alias].signature) {
                result = true;
            }
        });
        return result;
    }

    private _unsubscribe(signature: string, subscriptionId: string) {
        this._subscriptions.delete(subscriptionId);
        const handlers: Map<string, THandler> | undefined = this._handlers.get(signature);
        if (handlers === undefined) {
            return;
        }
        handlers.delete(subscriptionId);
        if (handlers.size === 0) {
            this._handlers.delete(signature);
        } else {
            this._handlers.set(signature, handlers);
        }
    }

    private _onPluginToken(message: IPCMessages.PluginToken) {
        this._token = message.token;
        this._id = message.id;
    }

}

export default (new PluginIPCService());

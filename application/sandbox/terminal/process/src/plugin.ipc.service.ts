import * as FS from 'fs';
import { EventEmitter } from 'events';
import { IPCMessage, IMessage } from './plugin.ipc.service.message';

export { IPCMessage, IMessage };

/**
 * @class PluginIPCService
 * @description Service provides communition between plugin's process and parent (main) process
 * @notes Parent (main) process attach plugin's process as fork with next FDs:
 *      { fd: 0 } stdin     doesn't used by parent process
 *      { fd: 1 } stdout    listened by parent process. Whole output from it goes to logs of parent process
 *      { fd: 2 } stderr    listened by parent process. Whole output from it goes to logs of parent process
 *      { fd: 3 } ipc       used by parent process as command sender / reciever
 *      { fd: 4 } pipe      listened by parent process. Used as bridge to data's stream. All data from this 
 *                          stream are redirected into session stream of parent process
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

    private _stream: FS.WriteStream;
    private _pending: Map<string, (message: IPCMessage) => any> = new Map();

    public static Events = {
        close: 'close',
        message: 'message'
    };

    public Events = PluginIPCService.Events;

    constructor() {
        super();
        // Check IPC (to communicate with parent process)
        if (process.send === void 0) {
            throw new Error(`Fail to init plugin, because IPC interface isn't available. Expecting 'ipc' on "fd:3"`);
        }
        // Create data's stream (to send data to main output stream)
        this._stream = FS.createWriteStream('', { fd: 4 });
        // Listen parent process for messages
        process.on('message', this._onMessage.bind(this));
    }

    /**
     * Sends message to parent (main) process via IPC without expecting any answer
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
     * Sends message to parent (main) process via IPC and waiting for a answer
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

    /**
     * Sends chunk of data to main data's stream 
     * @param {any} chunk package of data
     * @returns { Promise<void> }
     */
    public sendToStream(chunk: any): Promise<void> {
        return new Promise((resolve, reject) => {
            this._stream.write(chunk, (error: Error | null | undefined) => {
                if (error) {
                    return reject(error);
                }
                resolve();
            });
        });
    }

    /**
     * Returns write stream. Can be used to pipe write stream with source of data 
     * @returns { FS.WriteStream }
     */
    public getDataStream(): FS.WriteStream {
        return this._stream;
    }

    /**
     * Sends message to parent (main) process via IPC
     * @param {IPCMessage} data package of data
     * @param {boolean} expectResponse  true - promise will be resolved with income message with same "sequence"; 
     *                                  false (default) - promise will be resolved afte message be sent 
     * @returns { Promise<IPCMessage | undefined> }
     */
    private _send(message: IPCMessage, expectResponse: boolean = false): Promise<IPCMessage | undefined> {
        return new Promise((resolve, reject) => {
            if (!process.send) {
                return reject(new Error(`IPC isn't available`));
            }
            if (!(message instanceof IPCMessage)) {
                return reject(new Error(`Expecting as message instance of IPCMessage`));
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
    private _onMessage(data: any) {
        try {
            const message: IPCMessage = new IPCMessage(data);
            const resolver = this._pending.get(message.sequence);
            if (resolver !== undefined) {
                this._pending.delete(message.sequence);
                resolver(message);
            } else {
                this.emit(PluginIPCService.Events.message, message);
            }
        } catch (e) {
            console.log(`Incorrect format of IPC message: ${typeof data}`);
        }
    }

}

export default (new PluginIPCService());
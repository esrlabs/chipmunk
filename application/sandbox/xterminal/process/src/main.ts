import Logger from './env.logger';
import * as path from 'path';
import * as os from 'os';
import PluginIPCService from 'chipmunk.plugin.ipc';
import { IPCMessages } from 'chipmunk.plugin.ipc';
import * as pty from 'node-pty';

class Plugin {

    private _logger: Logger = new Logger('XTerminal');
    private _pty: pty.IPty | undefined;
    private _session: string | undefined;

    constructor() {
        this._onIncomeRenderIPCMessage = this._onIncomeRenderIPCMessage.bind(this);
        PluginIPCService.subscribe(IPCMessages.PluginInternalMessage, this._onIncomeRenderIPCMessage);
    }

    private _onIncomeRenderIPCMessage(message: IPCMessages.PluginInternalMessage, response: (res: IPCMessages.TMessage) => any) {
        // Process commands
        switch (message.data.command) {
            case 'create':
                return this._income_create(message).then(() => {
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
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case 'destroy':
                return this._income_destroy(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'destroied'
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
                            status: 'sent'
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
                this._logger.warn(`Unknown commad: ${message.data.event}`);
        }
    }

    private _income_write(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._pty === undefined) {
                return reject(new Error(this._logger.error(`PTY process isn't created, cannot send data into.`)));
            }
            this._pty.write(message.data.data);
            resolve();
        });
    }


    private _income_create(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._pty !== undefined) {
                return reject(new Error(this._logger.error(`PTY is already created.`)));
            }
            const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];
            this._pty = pty.spawn(shell as string, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 30,
                cwd: process.cwd(),
                env: process.env as any
            });
            this._pty.on('data', (data) => {
                PluginIPCService.sendToPluginHost(message.stream, {
                    event: 'data',
                    data: data,
                    session: this._session,
                }).catch((error: Error) => {
                    this._logger.error(`Fail to send data to plugin render due error: ${error.message}`);
                });
            });
            this._session = message.data.session;
            resolve();           
        });
    }

    private _income_destroy(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._pty === undefined) {
                return reject(`PTY is already destroied.`);
            }
            this._pty.kill();
            this._pty = undefined;
            resolve();           
        });
    }

}

const app: Plugin = new Plugin();

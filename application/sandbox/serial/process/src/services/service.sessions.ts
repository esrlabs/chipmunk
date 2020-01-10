import Logger from '../env/env.logger';
import PluginIPCService, { IPCMessages, ServiceConfig } from 'chipmunk.plugin.ipc';
import { ControllerSession } from '../controllers/controller.session';
import { ECommands } from '../consts/commands';
import ServicePorts, { IPortInfo } from './service.ports';

interface IPortOptions {
    autoOpen?: boolean;
    baudRate?: 115200|57600|38400|19200|9600|4800|2400|1800|1200|600|300|200|150|134|110|75|50|number;
    dataBits?: 8|7|6|5;
    highWaterMark?: number;
    lock?: boolean;
    stopBits?: 1|2;
    parity?: 'none'|'even'|'mark'|'odd'|'space';
    rtscts?: boolean;
    xon?: boolean;
    xoff?: boolean;
    xany?: boolean;
    bindingOptions?: {
        vmin?: number;
        vtime?: number;
    };
}

interface IOptions {
    path: string;
    options: IPortOptions;
    reader: {
        delimiter: string | number[];
        encoding?: 'ascii' | 'utf8' | 'utf16le' | 'ucs2' | 'base64' | 'binary' | 'hex' | undefined;
        includeDelimiter?: boolean | undefined;
    };
}

interface IRecentPortData {
    [port: string]: IOptions;
};

interface IPluginSettings {
    recent: IRecentPortData;
}

class ServiceSessions {

    private _sessions: Map<string, ControllerSession> = new Map();
    private _logger: Logger = new Logger('SerialPorts');

    constructor(){
        this._onIncomeRenderIPCMessage = this._onIncomeRenderIPCMessage.bind(this);
        this._onOpenStream = this._onOpenStream.bind(this);
        this._onCloseStream = this._onCloseStream.bind(this);
        PluginIPCService.subscribe(IPCMessages.PluginInternalMessage, this._onIncomeRenderIPCMessage);
        PluginIPCService.on(PluginIPCService.Events.openStream, this._onOpenStream);
        PluginIPCService.on(PluginIPCService.Events.closeStream, this._onCloseStream);
        ServiceConfig.setDefault<IPluginSettings>( { recent: {} } );
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all([
                Array.from(this._sessions.values()).map((controller: ControllerSession) => {
                    return new Promise((resolveController) => {
                        controller.destroy().catch((error: Error) => {
                            this._logger.error(`Error during destroying controller: ${error.message}`);
                        }).finally(resolveController);
                    });
                })
            ]).catch((destroyError: Error) => {
                this._logger.error(`Error during destroy: ${destroyError.message}`);
            }).finally(resolve);
        });
    }

    private _onIncomeRenderIPCMessage(message: IPCMessages.PluginInternalMessage, response: (res: IPCMessages.TMessage) => any) {
        if (message.token !== undefined) {
            ServicePorts.setToken(message.token);
        }
        switch (message.data.command) {
            case ECommands.open:
                return this._income_onOpen(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case ECommands.close:
                return this._income_onClose(message).then(() => {
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
            case ECommands.list:
                return this._income_onList(message).then((ports: IPortInfo[]) => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done',
                            ports: ports,
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
            case ECommands.send:
                return this._income_onSend(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'sent',
                        },
                        token: message.token,
                        stream: message.stream,
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
            case ECommands.spyStart:
                return this._income_onSpyStart(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });                
            case ECommands.spyStop:
                return this._income_onSpyStop(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case ECommands.write:
                return this._income_onWriteConfig(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case ECommands.read:
                return this._income_onReadConfig(message).then((settings: IRecentPortData) => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done',
                            settings: settings
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    response(new IPCMessages.PluginError({
                        message: error.message,
                        stream: message.stream,
                        token: message.token,
                        data: {
                            command: message.data.command
                        }
                    }));
                });
            case ECommands.remove:
                return this._income_onRemoveConfig(message).then(() => {
                    response(new IPCMessages.PluginInternalMessage({
                        data: {
                            status: 'done'
                        },
                        token: message.token,
                        stream: message.stream
                    }));
                }).catch((error: Error) => {
                    response(new IPCMessages.PluginError({
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

    private _income_onOpen(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            let controller: ControllerSession | undefined = this._sessions.get(streamId);
            if (controller === undefined) {
                return reject(new Error(this._logger.error(`Fail to open port, because session isn't created.`)));
            }
            if (typeof message.data !== 'object' || message.data === null) {
                return reject(new Error(this._logger.error(`Parameters arn't provided`)));
            }
            if (typeof message.data.options !== 'object' || message.data.options === null) {
                return reject(new Error(this._logger.error(`Options to open port aren't provided`)));
            }
            controller.open(message.data.options).then(() => {
                resolve();            
            }).catch((error: Error) => {
                this._logger.error(`Fail to open port due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _income_onList(message: IPCMessages.PluginInternalMessage): Promise<IPortInfo[]> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            let controller: ControllerSession | undefined = this._sessions.get(streamId);
            if (controller === undefined) {
                return reject(new Error(this._logger.error(`Fail to get list of ports, because session isn't created.`)));
            }
            ServicePorts.getList().then((ports: IPortInfo[]) => {
                resolve(ports);
            }).catch((error: Error) => {
                this._logger.error(`Fail to get port's list due error: ${error.message}`);
                reject(error);
            });           
        });
    }

    private _income_onClose(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            let controller: ControllerSession | undefined = this._sessions.get(streamId);
            if (controller === undefined) {
                return reject(new Error(this._logger.error(`Fail to open port, because session isn't created.`)));
            }
            if (typeof message.data !== 'object' || message.data === null) {
                return reject(new Error(this._logger.error(`Parameters arn't provided`)));
            }
            if (typeof message.data.path !== 'string' || message.data.path.trim() === '') {
                return reject(new Error(this._logger.error(`Cannot close port, because path isn't provided`)));
            }
            controller.close(message.data.path).then(() => {
                resolve();            
            }).catch((error: Error) => {
                this._logger.error(`Fail to close port "${message.data.path}" due error: ${error.message}`);
                reject(error);
            });           
        });
    }

    private _income_onSend(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if(message.data.cmd === '') {
                PluginIPCService.sendToStream(Buffer.from('\n'), message.stream);
            } else {
                const streamId: string | undefined = message.stream;
                if (streamId === undefined) {
                    return reject(new Error(this._logger.warn(`No target stream ID provided`)));
                }
                if (message === undefined) {
                    return reject(new Error(this._logger.error(`Fail to send message, because it's undefined`)))
                }
                let controller: ControllerSession | undefined = this._sessions.get(streamId);
                if (controller === undefined) {
                    return reject(new Error(this._logger.error(`Fail to open port, because session isn't created.`)));
                }
                if (typeof message.data !== 'object' || message.data === null) {
                    return reject(new Error(this._logger.error(`No message provided`)));
                }
                if (typeof message.data.path !== 'string' || message.data.path.trim() === '') {
                    return reject(new Error(this._logger.error(`Cannot send message, because path isn't provided`)));
                }
                ServicePorts.write(message.data.path, message.data.cmd).then(() => {
                    resolve();            
                }).catch((error: Error) => {
                    this._logger.error(`Fail to send message "${message.data.cmd}" to port "${message.data.path}" due error: ${error.message}`);
                    reject(error);
                });
            }
        });
    }

    private _income_onSpyStart(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            if (message === undefined) {
                return reject(new Error(this._logger.error(`Fail to start spying, because message is undefined`)))
            }
            let controller: ControllerSession | undefined = this._sessions.get(streamId);
            if (controller === undefined) {
                return reject(new Error(this._logger.error(`Failed to open ports, because session isn't created.`)));
            }
            if (typeof message.data !== 'object' || message.data === null) {
                return reject(new Error(this._logger.error(`Parameters arn't provided`)));
            }
            if (typeof message.data.options !== 'object' || message.data.options === null) {
                return reject(new Error(this._logger.error(`Options aren't provided`)));
            }
            controller.spyStart(message.data.options).then(() => {
            resolve();            
            }).catch((error: Error) => {
                this._logger.error(`Failed to open ports due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _income_onSpyStop(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamId: string | undefined = message.stream;
            if (streamId === undefined) {
                return reject(new Error(this._logger.warn(`No target stream ID provided`)));
            }
            if (message === undefined) {
                return reject(new Error(this._logger.error(`Fail to stop spying, because message is undefined`)));
            }
            let controller: ControllerSession | undefined = this._sessions.get(streamId);
            if (controller === undefined) {
                return reject(new Error(this._logger.error(`Failed to close ports, because session isn't created.`)));
            }
            if (typeof message.data !== 'object' || message.data === null) {
                return reject(new Error(this._logger.error(`Parameters arn't provided`)));
            }
            if (typeof message.data.options !== 'object' || message.data.options === null) {
                return reject(new Error(this._logger.error(`Options aren't provided`)));
            }
            controller.spyStop(message.data.options).then(() => {
                resolve();            
            }).catch((error: Error) => {
                this._logger.error(`Failed to close ports due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _income_onWriteConfig(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (message === undefined) {
                return reject(new Error(this._logger.error(`Fail to save configuration, because message is undefined`)));
            }
            this._updateConfig(message.data.options).then((settings: {}) => {
                ServiceConfig.write(settings).then(() => {
                    resolve();
                }).catch((error: Error) => {
                    reject(error);
                });
            }).catch((error: Error) => {
                this._logger.error(`Failed to save configurations due error: ${error.message}`);
                return reject(error);
            });
        });
    }

    private _income_onReadConfig(message: IPCMessages.PluginInternalMessage): Promise<IRecentPortData> {
        return new Promise((resolve, reject) => {
            ServiceConfig.read<IPluginSettings>().then(settings => {
                resolve(settings.recent);
            }).catch((error: Error) => {
                this._logger.error(`Failed to load configurations due error: ${error.message}`);
                reject(error);
            });
        });
    }

    private _income_onRemoveConfig(message: IPCMessages.PluginInternalMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceConfig.read<IPluginSettings>().then((settings: IPluginSettings) => {
                if (!settings.recent || Object.keys(settings.recent).length === 0) {
                    return;
                }
                if (message.data.port === '*') {
                    Object.keys(settings.recent).forEach((port: string) => {
                        delete settings.recent[port];
                    });
                } else {
                    delete settings.recent[message.data.port];
                }
                ServiceConfig.write(settings).then(() => {
                    resolve();
                }).catch((error: Error) => {
                    return reject(error);
                });
            }).catch((error: Error) => {
                this._logger.error(`Failed to remove settings due to error: ${error.message}`);
            });
        });
    }

    private _updateConfig(options: IOptions): Promise<{}> {
        return new Promise((resolve, reject)=> {
            ServiceConfig.read<IPluginSettings>().then((settings: IPluginSettings) => {
                if (!settings.recent) {
                    settings.recent = {};
                }
                settings.recent[options.path] = options;
                resolve(settings);
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    private _onOpenStream(session: string) {
        if (this._sessions.has(session)) {
            this._logger.warn(`Session "${session}" is already created`);
            return;
        }
        const controller: ControllerSession = new ControllerSession(session);
        this._sessions.set(session, controller);
    }

    private _onCloseStream(session: string) {
        let controller: ControllerSession | undefined = this._sessions.get(session);
        if (controller === undefined) {
            return;
        }
        controller.destroy().catch((error: Error) => {
            this._logger.error(`Error during closing session "${session}": ${error.message}`);
        }).finally(() => {
            this._sessions.delete(session);
        });
    }

}

export default new ServiceSessions();

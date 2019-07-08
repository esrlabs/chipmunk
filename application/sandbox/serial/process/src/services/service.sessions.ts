import Logger from '../env/env.logger';
import PluginIPCService from 'logviewer.plugin.ipc';
import { IPCMessages } from 'logviewer.plugin.ipc';
import { ControllerSession } from '../controllers/controller.session';
import { ECommands } from '../consts/commands';
import ServicePorts, { IPortInfo } from './service.ports';

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

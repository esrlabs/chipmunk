// tslint:disable: member-ordering

import * as Tools from '../../tools/index';

import Logger from '../../tools/env.logger';
import ServiceElectron from '../../services/service.electron';
import ServicePlugins from '../../services/service.plugins';
import ServiceStreamSource from '../../services/service.stream.sources';
import State from './state';
import ControllerIPCPlugin from '../plugins/plugin.process.ipc';
import ControllerStreamPty from '../stream.pty/controller';

import { DefaultOutputExport } from './output.export.default';
import { IPCMessages as IPCPluginMessages } from '../plugins/plugin.process.ipc';
import { IPCMessages as IPCElectronMessages, Subscription } from '../../services/service.electron';
import { Session } from "indexer-neon";
import { Dependency, DependencyConstructor } from './controller.dependency';
import { Socket } from './controller.socket';
import { Search } from './controller.search';
import { Charts } from './controller.charts';
import { Channel } from './controller.channel';

export interface ISubjects {
    destroyed: Tools.Subject<string>;
    inited: Tools.Subject<ControllerSession>;
}

export class ControllerSession {

    private readonly _subscriptions: { [key: string ]: Subscription } = { };
    private readonly _events: Channel = new Channel();
    private readonly _subjects: ISubjects = {
        destroyed: new Tools.Subject('destroyed'),
        inited: new Tools.Subject('created'),
    };
    private readonly _dependencies: {
        socket: Socket | undefined,
        search: Search | undefined,
        charts: Charts | undefined,
    } = {
        socket: undefined,
        search: undefined,
        charts: undefined,
    };
    private _logger: Logger;
    private _session: Session | undefined;

    constructor() {
        this._logger = new Logger(`ControllerSession (not inited)`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            // Kill all dependecies
            Promise.all(([
                this._dependencies.socket,
                this._dependencies.search,
                this._dependencies.charts,
            ].filter(d => d !== undefined) as Dependency[]).map((dep: Dependency) => {
                return dep.destroy().catch((err: Error) => {
                    this._logger.warn(`Fail to destroy dependency due err: ${err.message}`);
                    return Promise.resolve();
                });
            })).then(() => {
                if (this._session === undefined) {
                    this._logger.warn(`Attempt to destroy session even session wasn't inited at all`);
                    this._unsubscribe();
                    return resolve();
                }
                const guid: string = this._session.getUUID();
                const session: Session = this._session;
                session.destroy().catch((err: Error) => {
                    this._logger.error(`Fail to safely destroy session "${guid}" due error: ${err.message}`);
                }).finally(() => {
                    this._session = undefined;
                    this._ipc().unsubscribe();
                    resolve();
                    this._subjects.destroyed.emit(guid);
                    this._unsubscribe();
                });
            });
        });
    }

    public init(): Promise<string> {
        return new Promise((resolve, reject) => {
            // Factory for initialization of dependency
            function getDependency<T>(self: ControllerSession, sess: Session, Dep: DependencyConstructor<T>): Promise<Dependency & T> {
                return new Promise((res, rej) => {
                    const dependency = new Dep(sess, self._events);
                    self._logger.debug(`Initing ${dependency.getName()} for session ${sess.getUUID()}`);
                    dependency.init().then(() => {
                        self._logger.debug(`${dependency.getName()} inited successfully`);
                        res(dependency);
                    }).catch((err: Error) => {
                        rej(new Error(self._logger.error(`Fail to init ${dependency.getName()} due error: ${err.message}`)));
                    });
                });
            }
            // Initialization of session
            let session: Session;
            try {
                session = new Session();
            } catch (err) {
                this._logger.error(`Fail to create a session due error: ${err.message}`);
                this._unsubscribe();
                return reject(err);
            }
            session.init().then(() => {
                this._logger = new Logger(`ControllerSession: ${session.getUUID()}`);
                this._session = session;
                // Initialization of dependencies
                Promise.all([
                    getDependency<Socket>(this, session, Socket).then((dep: Socket) => {
                        this._dependencies.socket = dep;
                    }),
                    getDependency<Search>(this, session, Search).then((dep: Search) => {
                        this._dependencies.search = dep;
                    }),
                    getDependency<Charts>(this, session, Charts).then((dep: Charts) => {
                        this._dependencies.charts = dep;
                    }),
                ]).then(() => {
                    this._logger.debug(`Session "${session.getUUID()}" is created`);
                    this._ipc().subscribe();
                    resolve(session.getUUID());
                    this._subjects.inited.emit(this);
                }).catch(reject);
            }).catch((err: Error) => {
                this._logger.error(`Fail to init a session due error: ${err.message}`);
                this._unsubscribe();
                reject(err);
            });
        });
    }

    public get(): {
        UUID(): string,
        session(): Session,
    } {
        const session = this._session;
        if (session === undefined) {
            throw new Error(this._logger.error(`Cannot return session's UUID because session isn't inited`));
        }
        return {
            UUID(): string {
                return session.getUUID() as string;
            },
            session(): Session {
                return session;
            }
        };
    }

    public getSubjects(): ISubjects {
        return this._subjects;
    }

    private _ipc(): {
        subscribe(): void,
        unsubscribe(): void,
        handlers: {
            reset(message: IPCElectronMessages.TMessage, response: (message: IPCElectronMessages.TMessage) => void): void,
        }
    } {
        const self = this;
        return {
            subscribe(): void {
                ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamResetRequest, self._ipc().handlers.reset).then((subscription: Subscription) => {
                    self._subscriptions.StreamReset = subscription;
                }).catch((error: Error) => {
                    self._logger.warn(`Fail to subscribe to render event "StreamReset" due error: ${error.message}. This is not blocked error, loading will be continued.`);
                });
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions).forEach((key: string) => {
                    (self._subjects as any)[key].destroy();
                });
            },
            handlers: {
                reset(message: IPCElectronMessages.TMessage, response: (message: IPCElectronMessages.TMessage) => void): void {
                    if (!(message instanceof IPCElectronMessages.StreamResetRequest)) {
                        return;
                    }
                    if (message.guid !== self.get().UUID()) {
                        return;
                    }
                    self.get().session().reset().then(() => {
                        self._logger.debug(`Session "${message.guid}" was reset.`);
                        response(new IPCElectronMessages.StreamResetResponse({
                            guid: message.guid,
                        }));
                    }).catch((err: Error) => {
                        response(new IPCElectronMessages.StreamResetResponse({
                            guid: message.guid,
                            error: self._logger.warn(`Fail to reset session "${message.guid}" due error: ${err.message}.`),
                        }));
                    });
                }
            }
        };
    }

    private _unsubscribe() {
        Object.keys(this._subjects).forEach((key: string) => {
            (this._subjects as any)[key].destroy();
        });
    }

}

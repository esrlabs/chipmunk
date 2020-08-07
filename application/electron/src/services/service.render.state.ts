import Logger from '../tools/env.logger';
import ServiceElectron from './service.electron';

import * as Tools from '../tools/index';

import { IPCMessages, Subscription } from './service.electron';
import { IService } from '../interfaces/interface.service';

/**
 * @class ServiceRenderState
 * @description Listen render state
 */

export class ServiceRenderState implements IService {

    private _logger: Logger = new Logger('ServiceRenderState');
    private _subscriptions: { [key: string ]: Subscription } = { };
    private _state: IPCMessages.ERenderState | undefined;
    private _pending: {
        inited: Map<string, () => void>,
        ready: Map<string, () => void>,
    } = {
        inited: new Map(),
        ready: new Map(),
    };
    private _subjects: {
        inited: Tools.Subject<void>,
        ready: Tools.Subject<void>,
    } = {
        inited: new Tools.Subject<void>('inited'),
        ready: new Tools.Subject<void>('ready'),
    };
    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.subscribe(IPCMessages.RenderState, this._ipc_onRenderState.bind(this)).then((subscription: Subscription) => {
                this._subscriptions.renderState = subscription;
                resolve();
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "RenderState" due error: ${error.message}. This is not blocked error, loading will be continued.`);
                reject(error);
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].destroy();
            });
            Object.keys(this._subjects).forEach((key: string) => {
                (this._subjects as any)[key].destroy();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceRenderState';
    }

    public getSubjects(): {
        inited: Tools.Subject<void>,
        ready: Tools.Subject<void>,
    } {
        return this._subjects;
    }

    public ready(): boolean {
        return this._state === IPCMessages.ERenderState.ready;
    }

    public doOnReady(id: string, task: () => void) {
        if (this._state !== IPCMessages.ERenderState.ready) {
            if (this._pending.ready.has(id)) {
                return;
            }
            this._pending.ready.set(id, task);
        } else {
            this._execute(id, task);
        }
    }

    public doOnInit(id: string, task: () => void) {
        if (this._state !== IPCMessages.ERenderState.ready && this._state !== IPCMessages.ERenderState.inited) {
            if (this._pending.inited.has(id)) {
                return;
            }
            this._pending.inited.set(id, task);
        } else {
            this._execute(id, task);
        }
    }

    private _execute(id: string, task: () => void) {
        try {
            task();
        } catch (e) {
            this._logger.warn(`Fail start task id "${id}" due error: ${e.message}`);
        }
    }

    /**
     * Handler render's state
     * @returns void
     */
    private _ipc_onRenderState(state: IPCMessages.TMessage) {
        if (!(state instanceof IPCMessages.RenderState)) {
            return;
        }
        if (this._state === IPCMessages.ERenderState.ready) {
            return;
        }
        if (state.state === IPCMessages.ERenderState.inited) {
            this._pending.inited.forEach((task: () => void, id: string) => {
                this._execute(id, task);
            });
            this._pending.inited.clear();
        } else if (state.state === IPCMessages.ERenderState.ready) {
            this._pending.ready.forEach((task: () => void, id: string) => {
                this._execute(id, task);
            });
            this._subjects.ready.emit();
        }
        this._state = state.state;
    }

}

export default (new ServiceRenderState());

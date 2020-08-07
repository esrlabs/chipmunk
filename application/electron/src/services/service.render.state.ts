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
    private _ready: boolean = false;
    private _pending: Map<string, () => void> = new Map();
    private _subjects: {
        onRenderReady: Tools.Subject<void>,
    } = {
        onRenderReady: new Tools.Subject<void>('onRenderReady'),
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
            this._subjects.onRenderReady.destroy();
            resolve();
        });
    }

    public getName(): string {
        return 'ServicePackage';
    }

    public getSubjects(): {
        onRenderReady: Tools.Subject<void>,
    } {
        return this._subjects;
    }

    public ready(): boolean {
        return this._ready;
    }

    public do(id: string, task: () => void) {
        if (!this.ready()) {
            if (this._pending.has(id)) {
                return;
            }
            this._pending.set(id, task);
            return;
        }
        this._execute(id, task);
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
        if (state.state !== IPCMessages.ERenderState.ready) {
            return;
        }
        if (this._ready) {
            return;
        }
        this._ready = true;
        this._subjects.onRenderReady.emit();
        this._pending.forEach((task: () => void, id: string) => {
            this._execute(id, task);
        });
        this._pending.clear();
    }

}

export default (new ServiceRenderState());

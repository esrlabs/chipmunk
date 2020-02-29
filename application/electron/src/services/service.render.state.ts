import Logger from '../tools/env.logger';
import * as Tools from '../tools/index';

import ServiceElectron, { IPCMessages, Subscription } from './service.electron';

import { IService } from '../interfaces/interface.service';

/**
 * @class ServiceRenderState
 * @description Listen render state
 */

export class ServiceRenderState implements IService {

    private _logger: Logger = new Logger('ServiceRenderState');
    private _subscriptions: { [key: string ]: Subscription } = { };
    private _ready: boolean = false;
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
            ServiceElectron.IPC.subscribe(IPCMessages.RenderState, this._ipc_onRenderState).then((subscription: Subscription) => {
                this._subscriptions.renderState = subscription;
            }).catch((error: Error) => {
                this._logger.warn(`Fail to subscribe to render event "RenderState" due error: ${error.message}. This is not blocked error, loading will be continued.`);
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
    }

}

export default (new ServiceRenderState());

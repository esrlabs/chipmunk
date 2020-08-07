import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPCMessages, Subscription } from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';

export class RenderStateService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('RenderStateService');
    private _state: IPCMessages.ERenderState = IPCMessages.ERenderState.pending;
    private _journal: { [key: string]: boolean } = {};

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'RenderStateService';
    }

    public state(): {
        ready: () => void,
        inited: () => void,
    } {
        const self = this;
        return {
            ready() {
                self._set(IPCMessages.ERenderState.ready);
            },
            inited() {
                self._set(IPCMessages.ERenderState.inited);
            },
        };
    }

    private _set(state: IPCMessages.ERenderState) {
        if (this._journal[state]) {
            return this._logger.warn(`Attempt to set ERenderState.${state} state more than once.`);
        }
        ElectronIpcService.send(new IPCMessages.RenderState({
            state: state
        })).catch((sendingError: Error) => {
            this._logger.error(`Fail to send "IPCMessages.RenderState" message to host due error: ${sendingError.message}`);
        });
    }

}

export default (new RenderStateService());

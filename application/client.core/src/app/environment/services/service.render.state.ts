import * as Toolkit from 'chipmunk.client.toolkit';
import ElectronIpcService, { IPC } from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';

export class RenderStateService implements IService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('RenderStateService');
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
        ready: () => void;
        inited: () => void;
    } {
        const self = this;
        return {
            ready() {
                self._set(IPC.ERenderState.ready);
            },
            inited() {
                self._set(IPC.ERenderState.inited);
            },
        };
    }

    private _set(state: IPC.ERenderState) {
        if (this._journal[state]) {
            this._logger.warn(`Attempt to set ERenderState.${state} state more than once.`);
            return;
        }
        ElectronIpcService.send(
            new IPC.RenderState({
                state: state,
            }),
        ).catch((sendingError: Error) => {
            this._logger.error(
                `Fail to send "IPC.RenderState" message to host due error: ${sendingError.message}`,
            );
        });
    }
}

export default new RenderStateService();

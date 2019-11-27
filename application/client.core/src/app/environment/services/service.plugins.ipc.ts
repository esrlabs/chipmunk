
import * as Toolkit from 'chipmunk.client.toolkit';
import * as IPCElectronMessages from '../../../../../common/ipc/electron.ipc.messages/index';
import ControllerPluginIPC from '../controller/controller.plugin.ipc';
import ServiceElectronIpc from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';

type TToken = string;

export class PluginsIPCService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('PluginsIPCService');
    private _ipcs: Map<TToken, ControllerPluginIPC> = new Map();
    private _subscriptionPluginMessages: Toolkit.Subscription | undefined;

    constructor() {
        ServiceElectronIpc.subscribeOnPluginMessage(this._onPluginMessage.bind(this)).then((subscription: Toolkit.Subscription) => {
            this._subscriptionPluginMessages = subscription;
        }).catch((subscribeError: Error) => {
            this._logger.error(`Error to subscribe to income plugin messages due error: ${subscribeError.message}`);
        });
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public getName(): string {
        return 'PluginsIPCService';
    }

    public destroy() {
        if (this._subscriptionPluginMessages !== undefined) {
            this._subscriptionPluginMessages.unsubscribe();
        }
    }

    public addPlugin(token: TToken, controller: ControllerPluginIPC): Error | undefined {
        if (this._ipcs.has(token)) {
            return new Error(this._logger.error(`Plugin with token "${token}" was already added.`));
        }
        this._ipcs.set(token, controller);
    }

    public removePlugin(token: TToken): Error | undefined {
        const controller: ControllerPluginIPC | undefined = this._ipcs.get(token);
        if (controller === undefined) {
            return new Error(this._logger.warn(`Fail to find plugin with token "${token}".`));
        }
        controller.destroy();
        this._ipcs.delete(token);
    }

    public sendToHost(message: any, token: string, streamId?: string): Promise<void> {
        return ServiceElectronIpc.sendToPluginHost(message, token, streamId);
    }

    public requestFromHost(message: any, token: string, streamId?: string): Promise<void> {
        return ServiceElectronIpc.requestToPluginHost(message, token, streamId);
    }

    private _onPluginMessage(message: IPCElectronMessages.PluginInternalMessage) {
        this._ipcs.forEach((ipc: ControllerPluginIPC, token: TToken) => {
            if (token === message.token) {
                ipc.acceptHostMessage(message.data);
            }
        });
    }

}

export default (new PluginsIPCService());


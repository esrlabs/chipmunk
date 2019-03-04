import * as Tools from '../tools/index';
import PluginsIPCService from '../services/service.plugins.ipc';

export default class ControllerPluginIPC {

    private _token: string | undefined;
    private _name: string | undefined;
    private _logger: Tools.Logger;
    private _handlers: Map<string, Tools.THandler> = new Map();

    constructor(name: string, token: string) {
        this._token = token;
        this._name = name;
        this._logger = new Tools.Logger(`ControllerPluginIPC: ${name}`);
    }

    public destroy() {

    }

    public sentToHost(message: any, streamId?: string): Promise<void> {
        return PluginsIPCService.sendToHost(message, this._token, streamId);
    }

    public requestToHost(message: any, streamId?: string): Promise<any> {
        return PluginsIPCService.requestFromHost(message, this._token, streamId);
    }

    public subscribeToHost(handler: Tools.THandler): Promise<Tools.Subscription> {
        return new Promise((resolve) => {
            const signature: string = this._name;
            const subscriptionId: string = Tools.guid();
            this._handlers.set(subscriptionId, handler);
            const subscription: Tools.Subscription = new Tools.Subscription(signature, () => {
                this._handlers.delete(subscriptionId);
            }, subscriptionId);
            resolve(subscription);
        });
    }

    public acceptHostMessage(message: any) {
        this._handlers.forEach((handler: Tools.THandler) => {
            try {
                handler(message);
            } catch (error) {
                this._logger.error(`Error during emiting host event: ${error.message}. Message: `, message);
            }
        });
    }

}

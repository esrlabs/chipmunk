import * as Tools from '../tools/index';

export abstract class PluginIPC {

    public readonly token: string;
    public readonly name: string;

    private _logger: Tools.Logger;
    private _handlers: Map<string, Tools.THandler> = new Map();

    constructor(name: string, token: string) {
        this.token = token;
        this.name = name;
        this._logger = new Tools.Logger(`ControllerPluginIPC: ${name}`);
    }

    public destroy(): void {
        this._handlers.clear();
    }

    public abstract sentToHost(message: any, streamId?: string): Promise<void>;

    public abstract requestToHost(message: any, streamId?: string): Promise<any>;

    public getToken(): string {
        return this.token;
    }

    public getName(): string {
        return this.name;
    }

    public subscribeToHost(handler: Tools.THandler): Tools.Subscription {
        const signature: string = this.name;
        const subscriptionId: string = Tools.guid();
        this._handlers.set(subscriptionId, handler);
        return new Tools.Subscription(signature, () => {
            this._handlers.delete(subscriptionId);
        }, subscriptionId);
    }

    public acceptHostMessage(message: any): void {
        this._handlers.forEach((handler: Tools.THandler) => {
            try {
                handler(message);
            } catch (error) {
                this._logger.error(`Error during emiting host event: ${error.message}. Message: `, message);
            }
        });
    }

}

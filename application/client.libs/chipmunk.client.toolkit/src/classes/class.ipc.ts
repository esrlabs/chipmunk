import * as Tools from '../tools/index';

/**
 * @class PluginIPC
 * Abstract class, which used for creating plugin IPC controller.
 * Plugin IPC controller allows communicate between render part of plugin
 * and backend part of plugin.
 * Render part (render) - a plugin's part, which executes on front-end in browser
 * Backend part (host) - a plugin's part, which ececutes on back-end on nodejs level
 */
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

    /**
     * Internal usage
     */
    public destroy(): void {
        this._handlers.clear();
    }

    /**
     * Internal usage
     */
    public getToken(): string {
        return this.token;
    }

    /**
     * Internal usage
     */
    public getName(): string {
        return this.name;
    }

    /**
     * Sends message from render to host.
     * Note: this method doesn't wait for host's responce. It's just sender. This method could be used for example
     * for emitting of events or something like it.
     * @param {any} message - any message to be sent on host
     * @param streamId - id of releated stream
     * @returns {Promise<void>} resolved on message successfully sent; reject on sending errors
     */
    public abstract sentToHost(message: any, streamId?: string): Promise<void>;

    /**
     * Sends request from render to host.
     * This method sends request-message to host and waits for response.
     * @param {any} message - any message to be sent on host. As usual it's an object
     * @param {string} streamId - id of releated stream
     * @returns {Promise<void>} resolved with host's responce; reject on sending errors
     */
    public abstract requestToHost(message: any, streamId?: string): Promise<any>;

    /**
     * Subscriber to host messages
     * @param {(message: any) => void} handler - will be called with each host message
     * @returns {Subscription} subscription object, which could be used to unsubscribe
     */
    public subscribeToHost(handler: Tools.THandler): Tools.Subscription {
        const signature: string = this.name;
        const subscriptionId: string = Tools.guid();
        this._handlers.set(subscriptionId, handler);
        return new Tools.Subscription(signature, () => {
            this._handlers.delete(subscriptionId);
        }, subscriptionId);
    }

    /**
     * This method is for innternal usage. It's used by implementation of plugin IPC to emit
     * host's messages handler. Usage of this method by developer of plugin doesn't make sense.
     * @param {any} message - any message from host
     * @returns {void}
     */
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

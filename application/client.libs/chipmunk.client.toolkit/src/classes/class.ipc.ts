import * as Tools from '../tools/index';

/**
 * @class IPC
 * Abstract class, which used for creating a plugin IPC controller.
 * Plugin IPC controller allows communicating between render part of a plugin
 * and backend part of a plugin.
 * Render part (render) - a plugin's part, which executes on front-end in browser
 * Backend part (host) - a plugin's part, which executes on back-end on nodejs level
 */
export abstract class IPC {
    public readonly token: string;
    public readonly name: string;

    private _logger: Tools.Logger;
    private _handlers: Map<string, Tools.THandler> = new Map();

    constructor(name: string, token: string) {
        this.token = token;
        this.name = name;
        this._logger = new Tools.Logger(`ControllerIPC: ${name}`);
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
     * Note: this method doesn't wait for host's response. It's just a sender. This method could be used for example
     * for emitting of events or something like it.
     * @param {any} message - any message to be sent on host
     * @param streamId - id of related stream
     * @returns {Promise<void>} resolved on message successfully sent; reject on sending errors
     */
    public abstract send(message: any, streamId?: string): Promise<void>;

    /**
     * Sends a request from render to host.
     * This method sends request-message to host and waits for a response.
     * @param {any} message - any message to be sent on host. As usual, it's an object
     * @param {string} streamId - id of related stream
     * @returns {Promise<void>} resolved with host's response; reject on sending errors
     */
    public abstract request(message: any, streamId?: string): Promise<any>;

    /**
     * Subscriber to host messages
     * @param {(message: any) => void} handler - will be called with each host message
     * @returns {Subscription} subscription object, which could be used to unsubscribe
     */
    public subscribe(handler: Tools.THandler): Tools.Subscription {
        const signature: string = this.name;
        const subscriptionId: string = Tools.guid();
        this._handlers.set(subscriptionId, handler);
        return new Tools.Subscription(
            signature,
            () => {
                this._handlers.delete(subscriptionId);
            },
            subscriptionId,
        );
    }

    /**
     * This method is for internal usage. It's used by an implementation of plugin IPC to emit
     * host's messages handler. The usage of this method by the developer of plugin doesn't make sense.
     * @param {any} message - any message from host
     * @returns {void}
     */
    public accept(message: any): void {
        this._handlers.forEach((handler: Tools.THandler) => {
            try {
                handler(message);
            } catch (error) {
                this._logger.error(
                    `Error during emiting host event: ${
                        error instanceof Error ? error.message : error
                    }. Message: `,
                    message,
                );
            }
        });
    }
}

// Back compatibility (from 0.0.87)
export { IPC as PluginIPC };

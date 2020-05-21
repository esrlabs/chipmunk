import * as IPCMessages from '../../../../common/ipc/plugins.ipc.messages/index';

export interface IControllerIPCPlugin {

    /**
     * Sends message to plugin process via IPC without expecting any answer
     * @param {IPCMessages.TMessage} message instance of defined IPC message
     * @param {string} sequence sequence of message (if defined)
     * @returns { Promise<void> }
     */
    send(message: IPCMessages.TMessage, sequence?: string): Promise<IPCMessages.TMessage | undefined>;

    /**
     * Sends message to plugin process via IPC and waiting for an answer
     * @param {IPCMessages.TMessage} message instance of defined IPC message
     * @returns { Promise<IPCMessages.TMessage | undefined> }
     */
    request(message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined>;

}

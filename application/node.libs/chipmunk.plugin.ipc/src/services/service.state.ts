import PluginIPCService, { IPCMessages } from '../ipc/plugin.ipc.service';

/**
 * @class ServiceState
 * @description Sends confirmation about success/fail of start
 */
export class ServiceState {

    /**
     * Send to chipmunk core state of plugin;
     * @returns {Promise<void>}
     */
    public accept(): Promise<void> {
        return new Promise((resolve, reject) => {
            PluginIPCService.send(new IPCMessages.PluginState({ state: IPCMessages.EPluginState.ready })).then(() => {
                resolve();
            }).catch((error: Error) => {
                console.log(`Fail to send PluginState message due error: ${error.message}`);
                reject(error);
            });
        });
    }

}

export default new ServiceState();

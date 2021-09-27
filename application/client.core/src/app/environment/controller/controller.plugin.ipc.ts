import PluginsIPCService from '../services/service.plugins.ipc';
import * as Toolkit from 'chipmunk.client.toolkit';

export default class ControllerPluginIPC extends Toolkit.IPC {
    public send(message: any, streamId?: string): Promise<void> {
        PluginsIPCService.sendToHost(message, this.token, streamId);
        // TODO: switch ToolKit to sync and upgrade all plugins
        return Promise.resolve();
    }

    public request(message: any, streamId?: string): Promise<any> {
        return PluginsIPCService.requestFromHost(message, this.token, streamId);
    }
}

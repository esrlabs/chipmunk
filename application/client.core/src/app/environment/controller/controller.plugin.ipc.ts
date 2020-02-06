import PluginsIPCService from '../services/service.plugins.ipc';
import * as Toolkit from 'chipmunk.client.toolkit';

export default class ControllerPluginIPC extends Toolkit.IPC {

    public send(message: any, streamId?: string): Promise<void> {
        return PluginsIPCService.sendToHost(message, this.token, streamId);
    }

    public request(message: any, streamId?: string): Promise<any> {
        return PluginsIPCService.requestFromHost(message, this.token, streamId);
    }

}

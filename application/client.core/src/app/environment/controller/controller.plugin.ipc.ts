import PluginsIPCService from '../services/service.plugins.ipc';
import * as Toolkit from 'logviewer.client.toolkit';

export default class ControllerPluginIPC extends Toolkit.PluginIPC {

    public sentToHost(message: any, streamId?: string): Promise<void> {
        return PluginsIPCService.sendToHost(message, this.token, streamId);
    }

    public requestToHost(message: any, streamId?: string): Promise<any> {
        return PluginsIPCService.requestFromHost(message, this.token, streamId);
    }

}

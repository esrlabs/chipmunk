import PluginIPCService from './ipc/plugin.ipc.service';
import ServiceConfig from './services/service.config';
import GUID from './tools/tools.guid';
import Subscription from './tools/tools.subscription';

export { ServiceConfig as IServiceConfig } from './services/service.config';

export {
    PluginIPCService as IPluginIPCService,
    IPCMessages,
    IStreamInfo,
    IPipedStreamInfo,
    CStdoutSocketAliases,
} from './ipc/plugin.ipc.service';

export {
    IPCMessagePackage,
    IMessagePackage,
    getSequence,
} from './ipc/plugin.ipc.service.message';

export {
    GUID,
    Subscription,
    ServiceConfig,
    PluginIPCService,
};

export default PluginIPCService;

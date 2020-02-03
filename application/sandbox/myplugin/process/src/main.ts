import Logger from './env.logger';
import PluginIPCService from 'chipmunk.plugin.ipc';
import { IPCMessages } from 'chipmunk.plugin.ipc';

class Plugin {

    private _logger: Logger = new Logger('MyPlugin');

    constructor() {
        this._onIncomeRenderIPCMessage = this._onIncomeRenderIPCMessage.bind(this);
        PluginIPCService.subscribe(IPCMessages.PluginInternalMessage, this._onIncomeRenderIPCMessage);
    }

    private _onIncomeRenderIPCMessage(message: IPCMessages.PluginInternalMessage, response: (res: IPCMessages.TMessage) => any) {
        // Process commands
        switch (message.data.command) {
            case 'request':
                return response(new IPCMessages.PluginInternalMessage({
                    data: {
                        msg: '\'request\' was successful!'
                    },
                    token: message.token,
                    stream: message.stream
                }));
            case 'sent':
                return PluginIPCService.sendToPluginHost(message.stream, {
                    data: {
                        msg: '\'sent\' was successful!'
                    },
                    event: 'sent',
                    streamId: message.stream
                })
            default:
                this._logger.warn(`Unknown command: ${message.data.command}`);
        }
    }
}

const app: Plugin = new Plugin();

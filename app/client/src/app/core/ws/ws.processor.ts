import { WSCommandMessage   } from './ws.message.interface';
import { WSCommands         } from './ws.commands';

import { Logs, TYPES        } from '../modules/tools.logs';


class WSClientProcessor{
    private GUID        : string        = null;
    private commands    : WSCommands    = null;

    constructor(GUID : string){
        this.GUID       = GUID;
        this.commands   = new WSCommands(GUID);
    }

    validate(message: WSCommandMessage){
        let result = true;
        message.GUID    === void 0 && (result = false);
        message.command === void 0 && (result = false);
        message.params  === void 0 && (result = false);
        return result;
    }

    proceed(message : WSCommandMessage, sender: Function){
        if (this.validate(message)){
            return this.commands.proceed(message, sender);
        } else {
            Logs.msg(_('WebSocket server send not valid message.'), TYPES.ERROR);
        }
    }
}

export { WSClientProcessor };
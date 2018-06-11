import { MenuHandleInterface            } from './handle.interface';
import { APIProcessor                   } from "../api/api.processor";
import { APICommands                    } from "../api/api.commands";
import { APIResponse                    } from "../api/api.response.interface";

class UpdateChecks implements MenuHandleInterface{

    private processor   : any       = APIProcessor;

    constructor(){
    }

    start(){
        this.processor.send(
            APICommands.isUpdateAvailable,
            {},
            (response : APIResponse, error: Error) => {
            }
        );
    }

}

export { UpdateChecks };
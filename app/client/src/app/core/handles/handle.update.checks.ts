import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { APIProcessor                   } from "../api/api.processor";
import { APICommands                    } from "../api/api.commands";
import { APIResponse                    } from "../api/api.response.interface";
import { SimpleText                     } from "../components/common/text/simple/component";

class UpdateChecks implements MenuHandleInterface{

    private processor   : any       = APIProcessor;
    private progressGUID: symbol    = null;

    constructor(){
    }

    start(){
        this.showProgress('Please, wait...');
        this.processor.send(
            APICommands.checkUpdates,
            {},
            (response : APIResponse, error: Error) => {
                this.hideProgress();
                console.log(response);
                console.log(error);
            }
        );
    }

    showMessage(title: string, message: string){
        popupController.open({
            content : {
                factory     : null,
                component   : SimpleText,
                params      : {
                    text: message
                }
            },
            title   : title,
            settings: {
                move            : true,
                resize          : true,
                width           : '20rem',
                height          : '10rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : Symbol()
        });
    }

    showProgress(caption : string){
        this.progressGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : caption,
            settings: {
                move            : false,
                resize          : false,
                width           : '20rem',
                height          : '10rem',
                close           : false,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : this.progressGUID
        });
    }

    hideProgress(){
        if (this.progressGUID !== null){
            popupController.close(this.progressGUID);
            this.progressGUID = null;
        }
    }

}

export { UpdateChecks };
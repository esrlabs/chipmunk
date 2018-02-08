import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { DialogSettingsManager          } from '../components/common/dialogs/app.settings/component';

class OpenSettingsManager implements MenuHandleInterface{

    constructor(){
        this.start = this.start.bind(this);
    }

    init(){

    }

    start(){
        const GUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogSettingsManager,
                params      : {
                    close: () => {
                        popupController.close(GUID);
                    }
                }
            },
            title   : 'Application settings',
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '45rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }

}

const ApplicationSettingsManager = new OpenSettingsManager();

export { ApplicationSettingsManager };

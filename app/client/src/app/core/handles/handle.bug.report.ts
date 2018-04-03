import { MenuHandleInterface    } from './handle.interface';
import { popupController        } from '../components/common/popup/controller';
import { DialogBugReport        } from '../components/common/dialogs/dialog-bug-report/component';

class BugReport implements MenuHandleInterface{

    constructor(){
    }

    start(){
        this.showDialog();
    }

    showDialog(){
        let popupGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogBugReport,
                params      : {
                    popupGUID : popupGUID,
                    closeHandler: () => {
                        popupController.close(popupGUID);
                    }
                }
            },
            title   : _('Select New View'),
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '20rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popupGUID
        });
    }

}

export { BugReport };
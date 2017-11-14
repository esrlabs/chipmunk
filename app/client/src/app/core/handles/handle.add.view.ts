import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ViewsList                      } from '../components/common/dialogs/views.list/component';

class AddView implements MenuHandleInterface{

    constructor(){
    }

    start(){
        this.showList();
    }

    showList(){
        let popupGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ViewsList,
                params      : {
                    popupGUID : popupGUID
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

export { AddView };

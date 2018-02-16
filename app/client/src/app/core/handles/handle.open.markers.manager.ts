import { popupController                } from '../components/common/popup/controller';
import { DialogMarkersManager           } from '../components/common/dialogs/markers.manager/component';

class OpenMarkersManager{

    private GUID            : symbol        = Symbol();

    constructor(){
    }

    start(){
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMarkersManager,
                params      : {

                }
            },
            title   : 'Markers ',
            settings: {
                move            : true,
                resize          : true,
                width           : '20rem',
                height          : '15rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : this.GUID
        });
    }

}

export { OpenMarkersManager };

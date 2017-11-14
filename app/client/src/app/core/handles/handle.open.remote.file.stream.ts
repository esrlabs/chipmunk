import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { DialogA                        } from '../components/common/dialogs/dialog-a/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

import { APIProcessor                   } from '../api/api.processor';
import { APICommands                    } from '../api/api.commands';

class OpenRemoteFileStream{
    private GUID            : symbol        = Symbol();
    private progressGUID    : symbol        = Symbol();
    private processor       : any           = APIProcessor;

    constructor(){
    }

    showProgress(){
        this.progressGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : 'Please, wait...',
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
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.progressGUID);
    }

    dialog(){
        popupController.open({
            content : {
                factory     : null,
                component   : DialogA,
                params      : {
                    caption     : 'Path and filename of target',
                    value       : '',
                    type        : 'text',
                    placeholder : 'type filename and path to',
                    buttons     : [
                        {
                            caption : 'Open',
                            handle : function () {
                                Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.GUID);
                                this.sendRequest('test');
                            }.bind(this)
                        },
                        {
                            caption : 'Cancel',
                            handle : function () {
                                Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, this.GUID);
                            }.bind(this)
                        }
                    ]

                }
            },
            title   : 'Open ',
            settings: {
                move            : true,
                resize          : false,
                width           : '25rem',
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

    sendRequest(src: string){
        this.showProgress();
        this.processor.send(
            APICommands.OPEN_FILE_STREAM,
            {
                src : src,
                type: 'pipe'
            },
            this.onResponse.bind(this)
        );

    }

    onResponse(response: any, error: Error){
        console.log(response);
        this.hideProgress();
    }
}

export { OpenRemoteFileStream };
